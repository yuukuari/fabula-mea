/**
 * Email helper using Resend.
 * Falls back silently if RESEND_API_KEY is not set.
 */
import { Resend } from 'resend';

const FROM_EMAIL = 'Ecrire Mon Livre <noreply@ecrire-mon-livre.fr>';

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendReviewInviteEmail(opts: {
  to: string;
  authorName: string;
  bookTitle: string;
  reviewUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `${opts.authorName} vous invite à relire « ${opts.bookTitle} »`,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #8b2252; font-size: 24px;">Invitation à la relecture</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${opts.authorName}</strong> vous invite à relire son livre <strong>« ${opts.bookTitle} »</strong>.
          </p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Vous pourrez :</p>
          <ul style="font-size: 15px; color: #333; line-height: 1.8; padding-left: 20px;">
            <li>Lire les chapitres et scènes partagés</li>
            <li>Sélectionner du texte et ajouter des commentaires</li>
            <li>Envoyer vos commentaires quand vous êtes prêt</li>
            <li>Échanger avec l'auteur sur vos remarques</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${opts.reviewUrl}" 
               style="background-color: #8b2252; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              Commencer la relecture
            </a>
          </div>
          <p style="font-size: 13px; color: #888; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            Ce lien est personnel. Il vous donne accès à une session de relecture dédiée.
          </p>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send review invite email:', e);
  }
}

export async function sendCommentsNotificationEmail(opts: {
  to: string;
  readerName: string;
  bookTitle: string;
  commentCount: number;
  reviewUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `${opts.readerName} a envoyé ${opts.commentCount} commentaire${opts.commentCount > 1 ? 's' : ''} sur « ${opts.bookTitle} »`,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #8b2252; font-size: 24px;">Nouveaux commentaires</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${opts.readerName}</strong> a envoyé <strong>${opts.commentCount} commentaire${opts.commentCount > 1 ? 's' : ''}</strong> 
            sur votre livre <strong>« ${opts.bookTitle} »</strong>.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${opts.reviewUrl}" 
               style="background-color: #8b2252; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              Voir les commentaires
            </a>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send comments notification email:', e);
  }
}

export async function sendReviewCompletedEmail(opts: {
  to: string;
  readerName: string;
  bookTitle: string;
  reviewUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `${opts.readerName} a terminé la relecture de « ${opts.bookTitle} »`,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #8b2252; font-size: 24px;">Relecture terminée !</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${opts.readerName}</strong> a terminé la relecture de votre livre <strong>« ${opts.bookTitle} »</strong>.
          </p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Consultez ses commentaires et répondez-y directement sur la plateforme.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${opts.reviewUrl}" 
               style="background-color: #8b2252; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              Voir la relecture
            </a>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send review completed email:', e);
  }
}

export async function sendTicketCreatedEmail(opts: {
  to: string;
  ticketType: string;
  ticketModule?: string;
  title: string;
  description: string;
  authorName: string;
  authorEmail: string;
  ticketUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  const typeLabels: Record<string, string> = { bug: 'Bug', question: 'Question', improvement: 'Amélioration' };
  const typeLabel = typeLabels[opts.ticketType] || opts.ticketType;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `[Ticket ${typeLabel}] ${opts.title}`,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #8b2252; font-size: 24px;">Nouveau ticket : ${typeLabel}</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${opts.authorName}</strong> (${opts.authorEmail}) a créé un nouveau ticket.
          </p>
          <table style="font-size: 15px; color: #333; margin: 20px 0; border-collapse: collapse;">
            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Type</td><td>${typeLabel}</td></tr>
            ${opts.ticketModule ? `<tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Section</td><td>${opts.ticketModule}</td></tr>` : ''}
            <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Titre</td><td>${opts.title}</td></tr>
          </table>
          <div style="background: #f9f6f0; padding: 16px; border-radius: 8px; margin: 20px 0; font-size: 15px; color: #333; line-height: 1.6;">
            ${opts.description}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${opts.ticketUrl}" 
               style="background-color: #8b2252; color: white; padding: 14px 28px; 
                      text-decoration: none; border-radius: 8px; font-size: 16px; 
                      font-weight: bold; display: inline-block;">
              Voir le ticket
            </a>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send ticket created email:', e);
  }
}

export async function sendAuthorRepliedEmail(opts: {
  to: string;
  authorName: string;
  bookTitle: string;
  commentCount: number;
  reviewUrl: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: `${opts.authorName} a répondu à vos commentaires sur « ${opts.bookTitle} »`,
      html: `
        <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #8b2252; font-size: 24px;">Nouvelles réponses de l'auteur</h2>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            <strong>${opts.authorName}</strong> a envoyé <strong>${opts.commentCount} réponse${opts.commentCount > 1 ? 's' : ''}</strong>
            sur la relecture de <strong>« ${opts.bookTitle} »</strong>.
          </p>
          <p style="font-size: 16px; color: #333; line-height: 1.6;">
            Consultez ses réponses directement sur la page de relecture.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${opts.reviewUrl}"
               style="background-color: #8b2252; color: white; padding: 14px 28px;
                      text-decoration: none; border-radius: 8px; font-size: 16px;
                      font-weight: bold; display: inline-block;">
              Voir les réponses
            </a>
          </div>
        </div>
      `,
    });
  } catch (e) {
    console.error('Failed to send author replied email:', e);
  }
}
