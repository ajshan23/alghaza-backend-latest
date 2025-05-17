import { EmailTemplateParams } from "./actionNotificationEmailTemplate";

export interface EstimationTemplateParams extends EmailTemplateParams {
  estimationNumber?: string;
  checkerName?: string;
  projectName?: string;
  dueDate?: string;
}

export const getEstimationCheckedTemplate = ({
  userName = "Valued Team Member",
  actionUrl = "#",
  contactEmail = "propertymanagement@alhamra.ae",
  logoUrl = "https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/logo+alghazal.png",
  estimationNumber = "",
  checkerName = "a team member",
  projectName = "the project",
  dueDate = ""
}: EstimationTemplateParams = {}): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Estimation Checked Notification</title>
        <style>
            /* Reuse your existing styles from the other template */
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 20px; }
            .email-wrapper { max-width: 650px; margin: 0 auto; }
            .email-container { border: 2px solid #000; padding: 40px; border-radius: 8px; background-color: #ffffff; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
            .header { color: #1e2939; margin-bottom: 25px; text-align: center; padding-bottom: 15px; border-bottom: 2px solid #1e2939; }
            .logo-english { font-size: 24px; font-weight: 600; letter-spacing: 1px; }
            .greeting { margin-bottom: 25px; font-size: 18px; font-weight: 600; }
            .content { margin-bottom: 15px; font-size: 16px; color: #444; }
            .button-container { text-align: center; margin: 25px 0; }
            .button { background-color: #1e2939; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; }
            .details { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .detail-row { display: flex; margin-bottom: 8px; }
            .detail-label { font-weight: 600; width: 120px; }
            .signature { margin-top: 35px; font-weight: 700; font-size: 17px; }
        </style>
    </head>
    <body>
        <div class="email-wrapper">
            <div class="email-container">
                <div class="header">
                    <div class="logo-english">ALGHAZAL ALABYAD TECHNICAL SERVICES</div>
                </div>
                
                <div class="greeting">Dear ${userName},</div>
                
                <div class="content">
                    An estimation has been checked and requires your attention.
                </div>
                
                <div class="details">
                    <div class="detail-row">
                        <span class="detail-label">Estimation #:</span>
                        <span>${estimationNumber}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Project:</span>
                        <span>${projectName}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Checked By:</span>
                        <span>${checkerName}</span>
                    </div>
                    ${dueDate ? `
                    <div class="detail-row">
                        <span class="detail-label">Due Date:</span>
                        <span>${dueDate}</span>
                    </div>
                    ` : ''}
                </div>
                
                <div class="button-container">
                    <a href="${actionUrl}" class="button">Review Estimation</a>
                </div>
                
                <div class="content" style="margin-top: 30px;">
                    Please review this estimation at your earliest convenience.
                </div>
                
                <div class="signature">
                    Best regards,<br>
                    TECHNICAL SERVICE TEAM
                </div>
            </div>
        </div>
    </body>
    </html>
  `;
};