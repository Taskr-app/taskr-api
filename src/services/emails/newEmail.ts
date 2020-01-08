import { fromEmail } from './transporter';
import { emailTemplate } from './template';

export const newEmail = (
  email: string,
  verificationLink: string,
  previousEmail: string
) => {
  return {
    from: fromEmail,
    to: email,
    subject: 'New email request | Taskr',
    html: emailTemplate({
      header: 'Looks like you\'ve requested a new email',
      body: `You're receiving this email because you've requested
      to change your email from ${previousEmail} to ${email}. Click the button
      below to change and confirm your new email address. Once you make the confirmation
      your previous email address will no longer be valid and you must login with your new email
      from now. No other information or data will be lost or changed from your Taskr account.
      Thank you for using our app and services.`,
      cta: 'Confirm new email',
      link: `${process.env.CLIENT_URL}/new-email/success?email=${email}&id=${verificationLink}`,
      footer: 'This email will be invalid after 1 hour from being sent'
    })
  };
};
