import {
  Mutation,
  Resolver,
  Arg,
  UseMiddleware,
  Ctx,
  ID,
  Query,
  PubSub,
  Publisher,
  Subscription,
  Root
} from 'type-graphql';
import { Project } from '../entity/Project';
import { MyContext } from '../services/context';
import { User } from '../entity/User';
import { v4 } from 'uuid';
import { projectInviteEmail } from '../services/emails/projectInviteEmail';
import { transporter } from '../services/emails/transporter';
import { Team } from '../entity/Team';
import {
  generateProjectLink,
  comparePublicProjectLink
} from '../services/links';
import { isAuth, isOwner, rateLimit } from './middleware';
import { redisProjects } from '../services/redis/projects';
import { validateProjectInvitationLink } from './middleware/validateLink';
import { redisSeparator } from '../services/redis/keys';
import {
  InvitedUserResponse,
  InvitedUserSubscriptionPayload,
  AcceptedUserSubscriptionPayload
} from './types/InvitedUserResponse';

export const topics = {
  sendInvite: 'SEND_PROJECT_INVITE',
  acceptInvite: 'ACCEPT_PROJECT_INVITE'
};

@Resolver()
export class ProjectResolver {
  @Query(() => Project)
  @UseMiddleware(isAuth)
  async getUserProject(
    @Arg('id', () => ID) id: number,
    @Ctx() { payload }: MyContext
  ) {
    const project = await Project.createQueryBuilder('project')
      .innerJoinAndSelect('project.members', 'user', 'user.id = :userId', {
        userId: payload!.userId
      })
      .where('project.id = :projectId', { projectId: id })
      .innerJoinAndSelect('project.members', 'member')
      .innerJoinAndSelect('project.owner', 'owner')
      // .innerJoinAndSelect('project.lists', 'list')
      // .orderBy({
      //   'list.pos': 'ASC'
      // })
      .getOne();

    if (!project) {
      throw new Error(
        'This project doesn\'t exist or you don\'t have access to it'
      );
    }
    return project;
  }

  @Query(() => [Project])
  @UseMiddleware(isAuth)
  async getUserProjects(@Ctx() { payload }: MyContext) {
    const projects = await Project.createQueryBuilder('project')
      .innerJoin('project.members', 'user', 'user.id = :userId', {
        userId: payload!.userId
      })
      .innerJoinAndSelect('project.members', 'member')
      .innerJoinAndSelect('project.owner', 'owner')
      .getMany();

    return projects;
  }

  @Mutation(() => Project)
  @UseMiddleware(isAuth)
  async createProject(
    @Ctx() { payload }: MyContext,
    @Arg('name') name: string,
    @Arg('desc', { nullable: true }) desc?: string,
    @Arg('teamId', () => ID, { nullable: true }) teamId?: number
  ) {
    const user = await User.findOne({ where: { id: payload!.userId } });
    const project = await Project.create({
      name,
      desc,
      owner: user
    });
    if (teamId) {
      let team = await Team.findOne({ where: { id: teamId } });
      if (!team) throw new Error('This team doesn\'t exist');
      project.team = team;
    }
    project.members = [user!];
    return await project.save();
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth, isOwner(Project, 'id'))
  async updateProject(
    @Ctx() { entity: project }: { entity: Project },
    @Arg('id', () => ID) _id: number,
    @Arg('name', { nullable: true }) name?: string,
    @Arg('desc', { nullable: true }) desc?: string,
    @Arg('teamId', () => ID, { nullable: true }) teamId?: number
  ) {
    if (name && project.name !== name) {
      project.name = name;
    }

    if (desc && project.desc !== desc) {
      project.desc = desc;
    }

    if (teamId) {
      const team = await Team.findOne({ where: { id: teamId } });
      if (!team) throw new Error('This team doesn\'t exist');
      project.team = team;
    }

    await project.save();
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth, isOwner(Project, 'id'))
  async deleteProject(
    @Arg('id', () => ID) _id: number,
    @Ctx() { entity: project }: { entity: Project }
  ) {
    await project.remove();
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth, rateLimit(10))
  async sendProjectInviteLink(
    @Arg('projectId', () => ID) projectId: number,
    @Arg('emails', () => [String]) emails: [string],
    @Ctx() { payload }: MyContext,
    @PubSub(topics.sendInvite)
    publish: Publisher<InvitedUserSubscriptionPayload>,
    @Arg('message', { nullable: true }) message?: string
  ) {
    const me = await User.findOne({ where: { id: payload!.userId } });
    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project doesn\'t exist');

    await Promise.all(
      emails.map(async email => {
        if (email === me!.email) {
          return;
        }
        const link = v4();
        transporter.sendMail(
          projectInviteEmail({
            sender: me!.username,
            email,
            message,
            project,
            link: link
          })
        );
        await redisProjects.add({
          id: projectId,
          link,
          email
        });
        await publish({ email, projectId });
      })
    );
    return true;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(validateProjectInvitationLink, isAuth)
  async acceptProjectInviteLink(
    @Arg('email') email: string,
    @Arg('id', () => ID) id: number,
    @Arg('projectInviteLink') projectInviteLink: string,
    @Ctx() { payload }: MyContext,
    @PubSub(topics.acceptInvite)
    publish: Publisher<AcceptedUserSubscriptionPayload>
  ) {
    const user = await User.findOne({ id: payload!.userId });
    if (!user) throw new Error('This user doesn\'t exist');
    if (user.email !== email)
      throw new Error('You don\'t have access to accept this invitation');
    const project = await Project.findOne({
      relations: ['members'],
      where: { id }
    });
    if (!project) throw new Error('This project doesn\'t exist');
    project.members = [...project.members, user];
    await project.save();
    await publish({ ...user, projectId: id });
    await redisProjects.delete({ email, id, link: projectInviteLink });
    return true;
  }

  @Query(() => [InvitedUserResponse])
  async getProjectInvites(@Arg('projectId', () => ID) projectId: number) {
    const invitedUsers = await redisProjects.getAll({ id: projectId });
    return invitedUsers.map(async (email: string) => {
      const user = await User.findOne({ email });
      if (user) {
        return {
          email: user.email,
          avatar: user.avatar
        };
      }
      return {
        email: email.substr(0, email.indexOf(redisSeparator.project)),
        avatar: null
      };
    });
  }

  @Query(() => String)
  async getPublicProjectLink(@Arg('projectId', () => ID) projectId: number) {
    const project = await Project.findOne({ where: { id: projectId } });
    if (!project) throw new Error('This project doesn\'t exist');
    const publicLink = generateProjectLink(project.id);
    return publicLink;
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async acceptPublicProjectLink(
    @Arg('link') link: string,
    @Arg('projectId', () => ID) projectId: number,
    @Ctx() { payload }: MyContext
  ) {
    const me = await User.findOne({ where: { id: payload!.userId } });
    if (!me) throw new Error('This user doesn\'t exist');
    const project = await Project.findOne({
      relations: ['members'],
      where: { id: projectId }
    });
    if (!project) throw new Error('This project doesn\'t exist');
    if (!comparePublicProjectLink(link, projectId)) {
      throw new Error('This link is either incorrect or has expired');
    }
    project.members = [...project.members, me];
    await project.save();
    return true;
  }

  @Subscription(() => InvitedUserResponse, {
    topics: topics.sendInvite,
    filter: ({ payload, args }) =>
      parseInt(args.projectId) === parseInt(payload.projectId)
  })
  onSendProjectInvite(
    @Root() invitedUserPayload: InvitedUserSubscriptionPayload,
    @Arg('projectId', () => ID) _projectId: string | number
  ) {
    const { projectId, ...invitedUser } = invitedUserPayload;
    return invitedUser;
  }

  @Subscription(() => User, {
    topics: topics.acceptInvite,
    filter: ({ payload, args }) =>
      parseInt(args.projectId) === parseInt(payload.projectId)
  })
  onAcceptProjectInvite(
    @Root() acceptedUser: AcceptedUserSubscriptionPayload,
    @Arg('projectId', () => ID) _projectId: string | number
  ) {
    const { projectId, ...user } = acceptedUser;
    return user;
  }
}
