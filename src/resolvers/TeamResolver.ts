import { createBaseResolver } from './BaseResolver';

import { Team } from '../entity/Team';
import {
  Resolver,
  Arg,
  UseMiddleware,
  Ctx,
  Mutation,
  Query,
  ID
} from 'type-graphql';
import { v4 } from 'uuid';
import { MyContext } from '../services/context';
import { User } from '../entity/User';
import { redis } from '../services/redis';
import { transporter } from '../services/emails/transporter';
import { teamInviteEmail } from '../services/emails/teamInviteEmail';
import { Project } from '../entity/Project';
import { isAuth, rateLimit, isOwner } from './middleware';
import { uniqBy } from 'lodash';
import { redisKeys, redisExpirationDuration } from '../services/redis/keys';

const TeamBaseResolver = createBaseResolver('Team', Team);

@Resolver()
export class TeamResolver extends TeamBaseResolver {
  @Query(() => Team)
  @UseMiddleware(isAuth)
  async getUserTeam(
    @Arg('id', () => ID) id: number,
    @Ctx() { payload }: MyContext
  ) {
    const team = await Team.createQueryBuilder('team')
      .innerJoin('team.members', 'user', 'user.id = :userId', {
        userId: payload!.userId
      })
      .where('team.id = :teamId', { teamId: id })
      .innerJoinAndSelect('team.members', 'member')
      .leftJoinAndSelect('team.projects', 'projects')
      .getOne();
    if (!team)
      throw new Error(
        'This team doesn\'t exist or you don\'t have access to this team'
      );
    return team;
  }

  @Query(() => [Team])
  @UseMiddleware(isAuth)
  async getUserTeams(@Ctx() { payload }: MyContext) {
    const user = await User.findOne({
      relations: ['teams'],
      where: { id: payload!.userId }
    });
    if (!user) throw new Error('This user doesn\'t exist');
    return user.teams;
  }

  @Mutation(() => Team)
  @UseMiddleware(isAuth)
  async createTeam(@Arg('name') name: string, @Ctx() { payload }: MyContext) {
    const user = await User.findOne({ where: { id: payload!.userId } });
    const team = await Team.create({
      name,
      owner: user
    });
    team.members = [user!];
    return await team.save();
  }

  @Mutation(() => String)
  @UseMiddleware(isAuth, rateLimit(30))
  async sendTeamInviteLink(
    @Arg('teamId', () => ID) teamId: number,
    @Arg('email') email: string,
    @Ctx() { payload }: MyContext
  ) {
    const me = await User.findOne({ where: { id: payload!.userId } });
    const team = await Team.findOne({ where: { id: teamId } });
    if (!team) throw new Error('This team doesn\'t exist');

    const link = v4();
    await transporter.sendMail(
      teamInviteEmail({
        sender: me!.username,
        email,
        teamName: team.name,
        link
      })
    );
    await redis.hmset(redisKeys.teamInvite(email), { id: teamId, link });
    await redis.expire(redisKeys.teamInvite(email), redisExpirationDuration);
    return link;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async acceptTeamInviteLink(
    @Arg('email') email: string,
    @Arg('teamInviteLink') teamInviteLink: string,
    @Ctx() { payload }: MyContext
  ) {
    const { link: storedLink, id: teamId } = await redis.hgetall(
      redisKeys.teamInvite(email)
    );
    if (storedLink !== teamInviteLink) {
      throw new Error('This link has expired');
    }

    const user = await User.findOne({ id: payload!.userId });
    if (!user) throw new Error('This user doesn\'t exist');
    const team = await Team.findOne({ where: { id: teamId } });
    if (!team) throw new Error('This team doesn\'t exist');
    team.members = uniqBy([...team.members, user], 'id');
    await team.save();
    await redis.del(redisKeys.teamInvite(email));
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth, isOwner(Team, 'teamId'))
  async deleteTeamMember(
    @Arg('teamId', () => ID) _teamId: number,
    @Arg('userId', () => ID) userId: number,
    @Ctx() { entity: team }: { entity: Team }
  ) {
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw new Error('This user doesn\'t exist');
    if (user.id === team.owner.id) {
      throw new Error('The owner of the team cannot be removed');
    }
    team.members = team.members.filter(member => member.id !== user.id);
    await team.save();

    return true;
  }

  @Mutation(() => Team)
  @UseMiddleware(isAuth, isOwner(Team, 'teamId'))
  async updateTeam(
    @Arg('teamId', () => ID) _teamId: number,
    @Arg('name') name: string,
    @Ctx() { entity: team }: { entity: Team }
  ) {
    team.name = name;
    return await team.save();
  }

  @Mutation(() => Team)
  @UseMiddleware(isAuth, isOwner(Team, 'teamId'))
  async deleteTeamProject(
    @Arg('teamId', () => ID) _teamId: number,
    @Arg('projectId', () => ID) projectId: number
  ) {
    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) throw new Error('This project doesn\'t exist');
    project.team = null;
    return await project.save();
  }
}
