export interface EmailTemplateParams {
  userName?: string;
  actionUrl?: string;
  contactEmail?: string;
  logoUrl?: string;
  projectName?: string;
}

export const getEmailTemplate = ({
  userName = "Valued Customer",
  actionUrl = "#",
  contactEmail = "propertymanagement@alhamra.ae",
  logoUrl = "https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/logo+alghazal.png",
  projectName = "the project",
}: EmailTemplateParams = {}): string => {
  return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>ALGHAZAL ALABYAD TECHNICAL SERVICES</title>
          <style>
              body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  line-height: 1.6;
                  color: #333;
                  background-color: #f9f9f9;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  margin: 0;
                  padding: 20px;
              }
              
              .email-wrapper {
                  width: 100%;
                  max-width: 650px;
                  margin: 0 auto;
              }
              
              .email-container {
                  border: 2px solid #000;
                  padding: 40px;
                  border-radius: 8px;
                  background-color: #ffffff;
                  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
              }
              
              .header {
                  color: #1e2939;
                  margin-bottom: 25px;
                  text-align: center;
                  padding-bottom: 15px;
                  border-bottom: 2px solid #1e2939;
              }
              
              .logo-container {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  margin-bottom: 20px;
              }
              
              .logo-arabic {
                  font-size: 24px;
                  font-weight: 700;
                  margin-bottom: 5px;
                  direction: rtl;
              }
              
              .logo-subtext {
                  font-size: 16px;
                  direction: rtl;
                  margin-bottom: 15px;
                  color: #555;
              }
              
              .logo-divider {
                  width: 100%;
                  border-top: 1px solid #ddd;
                  margin: 10px 0;
              }
              
              .logo-english {
                  font-size: 24px;
                  font-weight: 600;
                  letter-spacing: 1px;
                  font-family: 'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif;
              }
              
              .greeting {
                  margin-bottom: 25px;
                  font-size: 18px;
                  font-weight: 600;
                  margin-top: 15px;
              }
              
              .content {
                  margin-bottom: 25px;
                  font-size: 16px;
                  color: #444;
              }
              
              .button-container {
                  text-align: center;
                  margin: 25px 0;
                  color: white;
              }
              
              .button {
                  display: inline-block;
                  background-color: #1e2939;
                  color: white;
                  padding: 14px 30px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: 600;
                  font-size: 16px;
                  transition: background-color 0.3s ease;
                  border: none;
                  cursor: pointer;
              }
              
              .button:hover {
                  background-color: #0f1a2a;
                  
              }
              
              .contact {
                  margin-top: 30px;
                  font-size: 15px;
                  color: #555;
              }
              
              .contact a {
                  color: #1e2939;
                  font-weight: 600;
                  text-decoration: none;
              }
              
              .contact a:hover {
                  text-decoration: underline;
              }
              
              .signature {
                  margin-top: 35px;
                  font-weight: 700;
                  font-size: 17px;
              }
              
              .divider {
                  border-top: 1px solid #ddd;
                  margin: 30px 0;
              }
          </style>
      </head>
      <body>
          <div class="email-wrapper">
              <div class="email-container">
                  <div class="header">
                      <div class="logo-container">
                          
                          <div class="logo-english">ALGHAZAL ALABYAD TECHNICAL SERVICES</div>
                      </div>
                  </div>
                  
                  <div class="greeting">Dear ${userName},</div>
                  
                  <div class="content">
                      You are receiving this notification because you have been assigned to ${projectName} by ALGHAZAL ALABYAD TECHNICAL SERVICES.
                  </div>
                  
                  <div class="content">
                      To view the project details, please click the button below:
                  </div>
                  
                  <div class="button-container">
                      <a href="${actionUrl}" class="button" style="color:white;">View Project Details</a>
                  </div>
                  
                  <div class="divider"></div>
                  
                  <div class="contact">
                      If you have any questions or need further assistance, please feel free to contact us at <a href="mailto:${contactEmail}">${contactEmail}</a>
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
