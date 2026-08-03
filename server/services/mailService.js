const nodemailer = require('nodemailer');
const https = require('https');
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

/**
 * Email Service - Send emails using Brevo Transactional Email API
 * Uses HTTPS-based API instead of SMTP to avoid connection timeouts on Render
 */

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_ACCOUNT_URL = 'https://api.brevo.com/v3/account';
const MAIL_FROM = process.env.MAIL_FROM || 'noreply@cosmos-craft.com';
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'CosmosCraft';

if (!BREVO_API_KEY) {
  console.warn('Mailer WARNING: BREVO_API_KEY is not set. Email sending will fail. Check Render environment variables.');
}

let transporter = null;
if (!BREVO_API_KEY) {
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: process.env.MAIL_PORT || 587,
    secure: process.env.MAIL_SECURE === 'true' || false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });
}

/**
 * Make a POST request to the Brevo API
 * @param {string} url - API endpoint
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
const brevoRequest = (url, body) => {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Brevo API error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Brevo API error: ${res.statusCode} - ${responseData}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
};

/**
 * Make a GET request to the Brevo API
 * @param {string} url - API endpoint
 * @returns {Promise<Object>} Response data
 */
const brevoGet = (url) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      method: 'GET',
      headers: {
        'api-key': BREVO_API_KEY,
        Accept: 'application/json',
      },
    };
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || `Brevo API error: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Brevo API error: ${res.statusCode} - ${responseData}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
};

/**
 * Send a single email via Brevo API or SMTP fallback
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body (HTML)
 * @param {string} options.text - Email body (Plain text fallback)
 * @returns {Promise<Object>} Brevo API response
 */
exports.sendMail = async (options) => {
  try {
    const maxAttempts = Number(process.env.MAIL_SEND_RETRIES) || 3;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        if (BREVO_API_KEY) {
          const payload = {
            sender: { email: MAIL_FROM, name: MAIL_FROM_NAME },
            to: [{ email: options.to }],
            subject: options.subject,
            htmlContent: options.html,
            textContent: options.text,
          };
          const response = await brevoRequest(BREVO_API_URL, payload);
          console.log('Email sent via Brevo:', response.messageId || response.id);
          return response;
        }

        const mailOptions = {
          from: MAIL_FROM,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        };
        const response = await transporter.sendMail(mailOptions);
        console.log('Email sent via SMTP:', response.messageId);
        return response;
      } catch (err) {
        attempt += 1;
        console.error(`Email sending error (attempt ${attempt}):`, err && err.message ? err.message : err);
        if (attempt >= maxAttempts) {
          throw err;
        }
        // simple backoff
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
  } catch (error) {
    console.error('Email sending error:', error.message);
    throw error;
  }
};

/**
 * Send verification email with OTP
 * @param {string} to - Recipient email
 * @param {string} otp - One-time password (6 digits)
 */
exports.sendVerificationEmail = async (to, otp) => {
  const subject = 'Verify Your CosmosCraft Account';
  const html = `<!doctype html>
<html lang="und" dir="auto" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title></title>
    <!--[if !mso]><!-->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!--<![endif]-->
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding:0; }
      body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
      table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
      img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
      p { display:block;margin:13px 0; }
    </style>
    <!--[if mso]>
    <noscript>
    <xml>
    <o:OfficeDocumentSettings>
      <o:AllowPNG/>
      <o:PixelsPerInch>96</o:PixelsPerInch>
    </o:OfficeDocumentSettings>
    </xml>
    </noscript>
    <![endif]-->
    <!--[if lte mso 11]>
    <style type="text/css">
      .mj-outlook-group-fix { width:100% !important; }
    </style>
    <![endif]-->
    
      <!--[if !mso]><!-->
        <link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700" rel="stylesheet" type="text/css">
        <style type="text/css">
          @import url(https://fonts.googleapis.com/css?family=Roboto:300,400,500,700);
        </style>
      <!--<![endif]-->



    <style type="text/css">
      @media only screen and (min-width:480px) {
        .mj-column-per-100 { width:100% !important; max-width: 100%; }
      }
    </style>
    <style media="screen and (min-width:480px)">
      .moz-text-html .mj-column-per-100 { width:100% !important; max-width: 100%; }
    </style>
    

    
      
    <style type="text/css">
h1 { font-size: 32px; font-weight: 700; color: #fafafa; margin: 0 0 12px 0; }
      h2 { font-size: 24px; font-weight: 700; color: #fafafa; margin: 0 0 10px 0; }
      h3 { font-size: 20px; font-weight: 600; color: #fafafa; margin: 0 0 8px 0; }
      a { color: #fafafa; }
      blockquote { border-left: 3px solid #fafafa; padding-left: 16px; margin: 0; }
      blockquote blockquote { border-left-color: #27272a; }
      code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; background-color: #27272a; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
      pre { background-color: #27272a; padding: 16px; border-radius: 8px; overflow-x: auto; margin: 0; }
      pre code { background-color: transparent; padding: 0; border-radius: 0; font-size: inherit; }
      ul, ol { margin: 0 0 8px 0; padding-left: 24px; }
      li { margin-bottom: 4px; }
      .task-list-item { list-style-type: none; margin-left: -24px; }
      ul ul, ol ol, ul ol, ol ul { margin-top: 4px; margin-bottom: 0; }
      mark { background-color: #fafafa33; padding: 2px 4px; border-radius: 2px; }
      dl { margin: 0 0 8px 0; }
      dt { font-weight: 700; margin-top: 8px; }
      dd { margin: 2px 0 0 24px; }
      img { vertical-align: middle; }
    </style>
    
  </head>
  <body style="word-spacing:normal;background-color:#09090b;">
    
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Confirm your email address</div>
  
    
      <div
         aria-roledescription="email" style="background-color:#09090b;" role="article" lang="und" dir="auto"
      >
        
       
      <!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
      <div  style="margin:0px auto;max-width:600px;">
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:32px 32px 24px 32px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:536px;" ><![endif]-->
          
      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >
        
      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
      >
        <tbody>
          
              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                >
                  
      <div
         style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:13px;line-height:1.5;text-align:center;color:#a1a1aa;"
      ><p width="200"></p></div>
    
                </td>
              </tr>
            
        </tbody>
      </table>
    
      </div>
    
         <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
        
      </div>
    
     
      <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#18181b" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
      <div  style="background:#18181b;background-color:#18181b;margin:0px auto;max-width:600px;">
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b;background-color:#18181b;width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:0 32px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:536px;" ><![endif]-->
          
      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >
        
      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
      >
        <tbody>
          
              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                >
                  
      <div
         style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:16px;line-height:1.6;text-align:left;color:#a1a1aa;"
      ><h1>Confirm your email address</h1>
<p>Your confirmation code is below - enter it in your open browser window and we'll help you get signed in.</p></div>
    
                </td>
              </tr>
            
        </tbody>
      </table>
    
      </div>
    
         <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
        
      </div>
    
     
      <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#18181b" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
      <div  style="background:#18181b;background-color:#18181b;margin:0px auto;max-width:600px;">
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b;background-color:#18181b;width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:8px 32px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:536px;" ><![endif]-->
          
      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >
        
      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-collapse:separate;"
      >
        <tbody>
          <tr>
            <td  style="background-color:#27272a;border-radius:8px;vertical-align:top;border-collapse:separate;padding:12px 16px;">
              
      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="" width="100%"
      >
        <tbody>
          
              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                >
                  
      <div
         style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:16px;line-height:1.6;text-align:center;color:#a1a1aa;"
      ><h1>${otp}</h1></div>
    
                </td>
              </tr>
            
        </tbody>
      </table>
    
             </td>
           </tr>
         </tbody>
       </table>
    
       </div>
    
         <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
        
      </div>
    
     
      <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" bgcolor="#18181b" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
      <div  style="background:#18181b;background-color:#18181b;margin:0px auto;max-width:600px;">
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b;background-color:#18181b;width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:0 32px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:536px;" ><![endif]-->
          
      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >
        
      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
      >
        <tbody>
          
              <tr>
                <td
                   align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                >
                  
      <div
         style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:16px;line-height:1.6;text-align:left;color:#a1a1aa;"
      ><p>If you didn't request this email, there's nothing to worry about, you can safely ignore it.</p></div>
    
                </td>
              </tr>
            
        </tbody>
      </table>
    
       </div>
    
         <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
        
      </div>
    
     
      <!--[if mso | IE]></td></tr></table><table align="center" border="0" cellpadding="0" cellspacing="0" class="" role="presentation" style="width:600px;" width="600" ><tr><td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]-->
    
    
      <div  style="margin:0px auto;max-width:600px;">
        
        <table
           align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"
        >
          <tbody>
            <tr>
              <td
                 style="direction:ltr;font-size:0px;padding:24px 32px 32px 32px;text-align:center;"
              >
                <!--[if mso | IE]><table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr><td class="" style="vertical-align:top;width:536px;" ><![endif]-->
          
      <div
         class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
      >
        
      <table
         border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%"
      >
        <tbody>
          
              <tr>
                <td
                   align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;"
                >
                  
      <div
         style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:13px;line-height:1.5;text-align:center;color:#a1a1aa;"
      ><p>CosmosCraft | Verify your account</p></div>
    
                </td>
              </tr>
            
        </tbody>
      </table>
    
       </div>
    
         <!--[if mso | IE]></td></tr></table><![endif]-->
              </td>
            </tr>
          </tbody>
        </table>
        
      </div>
    
      <!--[if mso | IE]></td></tr></table><![endif]-->
    
    
      </div>
    
  </body>
</html>`;

  const text = `Your CosmosCraft verification code is: ${otp} (expires in 15 minutes)`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} resetLink - Password reset URL
 */
exports.sendPasswordResetEmail = async (to, resetLink) => {
  const subject = 'Reset Your CosmosCraft Password';
  const html = `
    <h2>Password Reset Request</h2>
    <p>You requested a password reset. Click the link below to reset your password:</p>
    <a href="${resetLink}" style="background-color: #d4af37; color: #231f20; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Reset Password
    </a>
    <p>Or copy this link: ${resetLink}</p>
    <p>This link expires in 1 hour.</p>
    <p>If you didn't request this, please ignore this email.</p>
  `;

  const text = `Reset your password by clicking: ${resetLink}`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send password change confirmation email
 * @param {string} to - Recipient email
 * @param {string} resetLink - Password reset URL with token
 */
exports.sendPasswordChangeConfirmationEmail = async (to, resetLink) => {
  const subject = 'Confirm Your Password Change - CosmosCraft';
  const html = `<!doctype html>
<html lang="und" dir="auto" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <title></title>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style type="text/css">
      #outlook a { padding:0; }
      body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
      table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
      img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
      p { display:block;margin:13px 0; }
    </style>
    <link href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700" rel="stylesheet" type="text/css">
    <style type="text/css">
      @media only screen and (min-width:480px) {
        .mj-column-per-100 { width:100% !important; max-width: 100%; }
      }
    </style>
    <style type="text/css">
      h1 { font-size: 32px; font-weight: 700; color: #fafafa; margin: 0 0 12px 0; }
      h2 { font-size: 24px; font-weight: 700; color: #fafafa; margin: 0 0 10px 0; }
      h3 { font-size: 20px; font-weight: 600; color: #fafafa; margin: 0 0 8px 0; }
      a { color: #fafafa; }
    </style>
  </head>
  <body style="word-spacing:normal;background-color:#09090b;">
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">Confirm your password change</div>
    <div style="background-color:#09090b;" role="article" lang="und" dir="auto">
      <div style="margin:0px auto;max-width:600px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tbody>
            <tr>
              <td style="direction:ltr;font-size:0px;padding:32px 32px 24px 32px;text-align:center;">
                <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                    <tbody>
                      <tr>
                        <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                          <div style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:13px;line-height:1.5;text-align:center;color:#a1a1aa;"></div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="background:#18181b;background-color:#18181b;margin:0px auto;max-width:600px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b;background-color:#18181b;width:100%;">
          <tbody>
            <tr>
              <td style="direction:ltr;font-size:0px;padding:0 32px;text-align:center;">
                <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                    <tbody>
                      <tr>
                        <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                          <div style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:16px;line-height:1.6;text-align:left;color:#a1a1aa;">
                            <h1>Confirm Your Password Change</h1>
                            <p>You requested to change your password. Click the button below to confirm this change.</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="background:#18181b;background-color:#18181b;margin:0px auto;max-width:600px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b;background-color:#18181b;width:100%;">
          <tbody>
            <tr>
              <td style="direction:ltr;font-size:0px;padding:8px 32px;text-align:center;">
                <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="border-collapse:separate;">
                    <tbody>
                      <tr>
                        <td style="background-color:#d4af37;border-radius:8px;vertical-align:top;border-collapse:separate;padding:12px 16px;text-align:center;">
                          <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="" width="100%">
                            <tbody>
                              <tr>
                                <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                                  <div style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:16px;line-height:1.6;text-align:center;">
                                    <a href="${resetLink}" style="color: #1a1a1a; text-decoration: none; font-weight: 600;">
                                      Confirm Password Change
                                    </a>
                                  </div>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="background:#18181b;background-color:#18181b;margin:0px auto;max-width:600px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b;background-color:#18181b;width:100%;">
          <tbody>
            <tr>
              <td style="direction:ltr;font-size:0px;padding:0 32px;text-align:center;">
                <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                    <tbody>
                      <tr>
                        <td align="left" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                          <div style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:16px;line-height:1.6;text-align:left;color:#a1a1aa;">
                            <p>This link will expire in 60 minutes.</p>
                            <p>If you didn't request this password change, please ignore this email or contact support immediately.</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style="margin:0px auto;max-width:600px;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;">
          <tbody>
            <tr>
              <td style="direction:ltr;font-size:0px;padding:24px 32px 32px 32px;text-align:center;">
                <div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
                  <table border="0" cellpadding="0" cellspacing="0" role="presentation" style="vertical-align:top;" width="100%">
                    <tbody>
                      <tr>
                        <td align="center" style="font-size:0px;padding:10px 25px;word-break:break-word;">
                          <div style="font-family:Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;font-size:13px;line-height:1.5;text-align:center;color:#a1a1aa;">
                            <p>CosmosCraft | Confirm Password Change</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </body>
</html>`;

  const text = `Confirm your password change by clicking: ${resetLink}`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send appointment confirmation email
 * @param {string} to - Recipient email
 * @param {Object} appointment - Appointment details
 */
exports.sendAppointmentConfirmation = async (to, appointment) => {
  const subject = 'Appointment Confirmation - CosmosCraft';
  const html = `
    <h2>Your Appointment is Confirmed!</h2>
    <p>Thank you for booking with CosmosCraft.</p>
    <h3>Appointment Details:</h3>
    <ul>
      <li><strong>Date:</strong> ${appointment.date || 'TBD'}</li>
      <li><strong>Time:</strong> ${appointment.time || 'TBD'}</li>
      <li><strong>Service:</strong> ${appointment.service || 'Custom Service'}</li>
      <li><strong>Status:</strong> ${appointment.status || 'Pending'}</li>
    </ul>
    <p>We look forward to serving you!</p>
    <p>CosmosCraft Team</p>
  `;

  const text = `Your appointment on ${appointment.date} at ${appointment.time} has been confirmed.`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Send order confirmation email
 * @param {string} to - Recipient email
 * @param {Object} order - Order details
 */
exports.sendOrderConfirmation = async (to, order) => {
  const subject = 'Order Confirmation - CosmosCraft';
  const html = `
    <h2>Order Confirmed!</h2>
    <p>Thank you for your purchase.</p>
    <h3>Order Details:</h3>
    <ul>
      <li><strong>Order ID:</strong> ${order.id || 'N/A'}</li>
      <li><strong>Total Amount:</strong> $${order.total || '0.00'}</li>
      <li><strong>Status:</strong> ${order.status || 'Processing'}</li>
    </ul>
    <p>You will receive tracking information once your order ships.</p>
    <p>Thank you for your business!</p>
  `;

  const text = `Order #${order.id} has been confirmed. Total: $${order.total}`;

  return exports.sendMail({ to, subject, html, text });
};

/**
 * Verify email service connection on startup
 */
exports.verifyConnection = async () => {
  try {
    if (BREVO_API_KEY) {
       const response = await brevoGet(BREVO_ACCOUNT_URL);
       console.log('Email service connected via Brevo API:', response.email);
       return true;
     }

    await transporter.verify();
    console.log('Email service connected successfully');
    return true;
  } catch (error) {
    console.error('Email service connection failed:', error.message);
    return false;
  }
};

module.exports = exports;