export interface WorkProgressTemplateParams {
  userName?: string;
  projectName?: string;
  progress?: number;
  progressDetails?: string;
  contactEmail?: string;
  logoUrl?: string;
  actionUrl?: string;
}

export const getWorkProgressTemplate = ({
  userName = "Valued Customer",
  projectName = "your project",
  progress = 0,
  progressDetails = "",
  contactEmail = "propertymanagement@alhamra.ae",
  logoUrl = "https://krishnadas-test-1.s3.ap-south-1.amazonaws.com/alghazal/logo+alghazal.png",
  actionUrl = "#"
}: WorkProgressTemplateParams = {}): string => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
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
        }
        .email-container {
          border: 2px solid #000;
          padding: 40px;
          border-radius: 8px;
          background-color: #ffffff;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          padding-bottom: 15px;
          border-bottom: 2px solid #1e2939;
          margin-bottom: 25px;
        }
        .logo-english {
          font-size: 22px;
          font-weight: bold;
          letter-spacing: 1px;
          color: #1e2939;
        }
        .greeting {
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
        }
        .content {
          font-size: 16px;
          color: #444;
          margin-bottom: 20px;
        }
        .progress-details {
          background: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .progress-bar {
          height: 20px;
          background: #e0e0e0;
          border-radius: 10px;
          margin: 15px 0;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: #1e2939;
          width: ${progress}%;
          transition: width 0.3s ease;
        }
        .button-container {
          text-align: center;
          margin: 25px 0;
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
        }
        .button:hover {
          background-color: #0f1a2a;
        }
        .divider {
          border-top: 1px solid #ddd;
          margin: 30px 0;
        }
        .contact {
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
          margin-top: 30px;
          font-weight: 700;
          font-size: 17px;
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
            We are pleased to provide you with the latest progress update on your ongoing project with ALGHAZAL ALABYAD TECHNICAL SERVICES.
          </div>

          <div class="progress-details">
            <strong>Project Name:</strong> ${projectName}<br>
            <strong>Current Progress:</strong><br>
            <div class="progress-bar">
              <div class="progress-bar-fill"></div>
            </div>
            ${progress}% Complete<br><br>
            ${progressDetails ? `<strong>Progress Details:</strong><br>${progressDetails}` : ''}
          </div>

          <div class="content">
            Our team has made significant progress as outlined above. Below is a detailed breakdown of the work completed since our last update:
            <!-- You can add specific progress items here if needed -->
          </div>

          <div class="button-container">
            <a href="${actionUrl}" class="button">View Project Details</a>
          </div>

          <div class="content">
            Should you require any additional information or have specific questions about the progress, please don't hesitate to contact us. We will continue to keep you updated as the project moves forward.
          </div>

          <div class="divider"></div>

          <div class="contact">
            If you have any questions or require further clarification, feel free to contact us at 
            <a href="mailto:${contactEmail}">${contactEmail}</a>
          </div>

          <div class="signature">
            Best regards,<br>
            TECHNICAL SERVICES TEAM
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};