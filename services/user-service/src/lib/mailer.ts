export interface PasswordResetMail {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
}

/**
 * Envío de emails en modo dev: el enlace queda en el log del servicio.
 * Para producción, reemplazar el cuerpo por nodemailer (SMTP) u otro
 * proveedor guiado por MAILER_PROVIDER, sin cambiar a los llamadores.
 */
export async function sendPasswordResetEmail(
  mail: PasswordResetMail
): Promise<void> {
  console.log(
    `[mailer:dev] enlace de recuperación para ${mail.to} ` +
      `(expira en ${mail.expiresMinutes} min): ${mail.resetUrl}`
  );
}
