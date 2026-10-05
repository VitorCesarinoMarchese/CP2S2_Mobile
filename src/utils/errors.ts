export function readableError(error: unknown): string {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
      'auth/weak-password': 'Use uma senha com pelo menos 6 caracteres.',
      'auth/invalid-email': 'Informe um e-mail válido.',
      'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde e tente novamente.',
      'permission-denied': 'Você não tem acesso a estes dados.',
      PERMISSION_DENIED: 'Seu acesso à conversa foi encerrado.',
      'storage/unauthorized':
        'Não foi possível enviar a foto. Verifique as regras de armazenamento.',
    };
    return messages[error.code] ?? 'Não foi possível concluir a ação. Tente novamente.';
  }
  return error instanceof Error
    ? error.message
    : 'Não foi possível concluir a ação. Tente novamente.';
}
