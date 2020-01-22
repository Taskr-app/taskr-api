import nodemailer from 'nodemailer';
import { stubTransport } from 'nodemailer-stub'

const transport = () => {
  switch(process.env.NODE_ENV) {
    case 'production':
      return {
        service: 'gmail',
        auth: {
          user: process.env.MAILER_EMAIL,
          pass: process.env.MAILER_PASSWORD
        }
      };

    case 'development':
      return {
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: process.env.MAILER_EMAIL,
          pass: process.env.MAILER_PASSWORD
        }
      };

    case 'test':
      return stubTransport

    default:
      return {
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: process.env.MAILER_EMAIL,
          pass: process.env.MAILER_PASSWORD
        }
      };
  }
}

export const transporter = nodemailer.createTransport(transport());
export const fromEmail = `Do Not Reply <${process.env.MAILER_EMAIL}>`;
