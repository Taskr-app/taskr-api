import { fromEmail } from './transporter';
import { emailTemplate } from './template';
import { Project } from '../../entity/Project';

interface emailArgs {
  sender: string;
  email: string;
  project: Partial<Project>;
  link: string;
  message?: string;
}

export const projectInviteEmail = ({
  sender,
  email,
  project,
  link,
  message
}: emailArgs) => {
  return {
    from: fromEmail,
    to: email,
    subject: 'Project Invite | Taskr',
    html: emailTemplate({
      header: `${sender} has sent you a project invite to ${project.name}`,
      message,
      body: `You've been invited as a project member to ${project.name}. You will have access to all tasks and messages shared in the project.`,
      cta: 'Accept project invitation',
      link: `${process.env.CLIENT_URL}/invite/project/success?email=${email}&id=${project.id}&link=${link}`,
      footer: 'This email will be invalid after 2 hours from being sent'
    })
  };
};
