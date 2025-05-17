import nodemailer, { Transporter, SendMailOptions } from "nodemailer";
import {
  getEmailTemplate,
  EmailTemplateParams,
} from "../template/actionNotificationEmailTemplate";

export interface EmailOptions extends Partial<SendMailOptions> {
  to: string;
  subject: string;
  templateParams?: EmailTemplateParams;
}

export interface MailerConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

export class Mailer {
  private transporter: Transporter;
  private config: MailerConfig;

  constructor(config: MailerConfig) {
    this.config = config;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    const { to, subject, templateParams, ...mailOptions } = options;

    const html = mailOptions.html || getEmailTemplate(templateParams);

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to,
        subject,
        text:
          mailOptions.text || "Please enable HTML to view this email content.",
        html,
        ...mailOptions,
      });

      console.log("Message sent: %s", info.messageId);
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log("Server is ready to take our messages");
      return true;
    } catch (error) {
      console.error("Connection verification failed:", error);
      return false;
    }
  }
}

// Example configuration - you would typically get this from environment variables
export const mailerConfig: MailerConfig = {
  host: "smtp.gmail.com", // smtp.gmail.com
  port: 465, // 465
  secure: true, // true for Gmail
  auth: {
    user: "ajmalshahan23@gmail.com", // Your full Gmail
    pass: "tmia vokj mfgs khzn", // Your App Password
  },
  from: `"ALGHAZAL ALABYAD TECHNICAL SERVICES" `,
};

// Singleton instance (optional)
export const mailer = new Mailer(mailerConfig);
