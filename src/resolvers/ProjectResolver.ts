import {
  Mutation,
  Resolver,
  Arg,
  UseMiddleware,
  Ctx,
  ID,
  Query
} from 'type-graphql';
import { Project } from '../entity/Project';
import { MyContext } from '../services/context';
import { User } from '../entity/User';
import { v4 } from 'uuid';
import { redis } from '../services/redis';
import { projectInviteEmail } from '../services/emails/projectInviteEmail';
import { transporter } from '../services/emails/transporter';
import { Team } from '../entity/Team';
import { generateProjectLink } from '../services/links';
import { isAuth, isOwner, rateLimit } from './middleware';
import { redisKeys, redisExpirationDuration } from '../services/redis/keys';

@Resolver()
export class ProjectResolver {
  @Query(() => Project)
  @UseMiddleware(isAuth)
  async getUserProject(
    @Arg('id', () => ID) id: number,
    @Ctx() { payload }: MyContext
  ) {
    try {
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
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => [Project])
  @UseMiddleware(isAuth)
  async getUserProjects(@Ctx() { payload }: MyContext) {
    try {
      const projects = await Project.createQueryBuilder('project')
        .innerJoin('project.members', 'user', 'user.id = :userId', {
          userId: payload!.userId
        })
        .innerJoinAndSelect('project.members', 'member')
        .innerJoinAndSelect('project.owner', 'owner')
        .getMany();

      return projects;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => [String])
  @UseMiddleware(isAuth)
  async getProjectInvitees(
    @Arg('id', () => ID) id: number
  ) {
    try {

    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Project)
  @UseMiddleware(isAuth)
  async createProject(
    @Ctx() { payload }: MyContext,
    @Arg('name') name: string,
    @Arg('desc', { nullable: true }) desc?: string,
    @Arg('teamId', () => ID, { nullable: true }) teamId?: number
  ) {
    try {
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
    } catch (err) {
      console.log(err);
      return err;
    }
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
    try {
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
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth, isOwner(Project, 'id'))
  async deleteProject(
    @Arg('id', () => ID) _id: number,
    @Ctx() { entity: project }: { entity: Project }
  ) {
    try {
      await project.remove();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth, rateLimit(10))
  async sendProjectInviteLink(
    @Arg('projectId', () => ID) projectId: string,
    @Arg('emails', () => [String]) emails: [string],
    @Ctx() { payload }: MyContext,
    @Arg('message', { nullable: true }) message?: string
  ) {
    try {
      const me = await User.findOne({ where: { id: payload!.userId } });
      const project = await Project.findOne({ where: { id: projectId } });
      if (!project) throw new Error('Project doesn\'t exist');

      emails.forEach(async email => {
        if (email === me!.email) {
          return;
        }
        const invitationLink = v4();
        await transporter.sendMail(
          projectInviteEmail({
            sender: me!.username,
            email,
            message,
            projectName: project.name,
            link: invitationLink
          })
        );
        await redis.hmset(redisKeys.projectInvite(email), {
          id: projectId,
          link: invitationLink
        });
        await redis.sadd(redisKeys.projectInvites(projectId), email)
        await redis.expire(redisKeys.projectInvite(email), redisExpirationDuration);
      });
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async acceptProjectInviteLink(
    @Arg('email') email: string,
    @Arg('projectInviteLink') projectInviteLink: string,
    @Ctx() { payload }: MyContext
  ) {
    try {
      const { link: storedLink, id: projectId } = await redis.hgetall(
        redisKeys.projectInvite(email)
      );
      if (storedLink !== projectInviteLink) {
        throw new Error('This link has expired');
      }

      const user = await User.findOne({ id: payload!.userId });
      if (!user) throw new Error('This user doesn\'t exist');
      const project = await Project.findOne({
        relations: ['members'],
        where: { id: projectId }
      });
      if (!project) throw new Error('This project doesn\'t exist');
      project.members = [...project.members, user];
      await project.save();
      await redis.del(redisKeys.projectInvite(email));
      await redis.srem(redisKeys.projectInvites(projectId), email)
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Query(() => String)
  async getPublicProjectLink(@Arg('projectId', () => ID) projectId: number) {
    try {
      const project = await Project.findOne({ where: { id: projectId } });
      if (!project) throw new Error('This project doesn\'t exist');
      const publicLink = generateProjectLink(project.id);
      return publicLink;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  async acceptPublicProjectLink(
    @Arg('link') link: String,
    @Arg('projectId', () => ID) projectId: number,
    @Ctx() { payload }: MyContext
  ) {
    try {
      const me = await User.findOne({ where: { id: payload!.userId } });
      if (!me) throw new Error('This user doesn\'t exist');
      const project = await Project.findOne({
        relations: ['members'],
        where: { id: projectId }
      });
      if (!project) throw new Error('This project doesn\'t exist');
      const publicLink = generateProjectLink(project.id);
      if (publicLink !== link) {
        throw new Error('This link is either incorrect or has expired');
      }
      project.members = [...project.members, me];
      await project.save();
      return true;
    } catch (err) {
      console.log(err);
      return err;
    }
  }
}
