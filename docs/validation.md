# Validação antes da entrega

## Ambiente publicado

- Registrar a URL HTTPS real no README e em `EXPO_PUBLIC_API_URL`.
- Conferir `/health` com o computador da equipe desligado.
- Conferir regras publicadas e integração com o mesmo projeto de `firebaseConfig.json`.
- Confirmar credenciais Admin somente na hospedagem e conta com permissões limitadas.

## Dois aparelhos, contas por senha

1. Criar duas contas com fotos, nome, e-mail, celular e data de nascimento.
2. Sair e reabrir o aplicativo. Conferir restauração da sessão e dados.
3. Iniciar conversa individual pelo diretório. Iniciar novamente pelo outro aparelho e conferir o mesmo histórico.
4. Enviar mensagens dos dois lados, sem refresh. Tocar no avatar e conferir perfil permitido.
5. Criar grupo com limite 3, incluindo proprietário. Adicionar terceiro integrante e conferir zero vagas. Tentar reduzir para 2 ou incluir quarto integrante: deve falhar.
6. Editar simultaneamente em dois aparelhos autenticados como proprietário: uma versão antiga deve falhar com mensagem para reabrir a edição.
7. Remover um integrante enquanto ele mantém o chat aberto. Conferir que as mensagens desaparecem da tela e que leitura/envio futuros são negados.
8. Tocar na foto do grupo, listar integrantes e abrir perfil. Conferir que alguém sem conversa comum não consegue consultar o perfil completo pela API.
9. Sair da conta com chat aberto, inclusive offline. Voltar ao fluxo de autenticação sem histórico protegido.

## Push real

1. Instalar development builds com FCM/APNs configurados. Ativar notificações nos aparelhos e conferir documentos privados de dispositivos via console administrativo.
2. Mandar mensagem individual com o destinatário em segundo plano e depois com app fechado. Capturar push real recebido. Tocar e conferir conversa correta.
3. Para `all_group_messages`, mandar mensagem geral e conferir destinatários, exceto remetente.
4. Para `mentioned_members`, selecionar um integrante no seletor Para. Conferir push somente para ele, mas mensagem visível para todo o grupo.
5. Para `direct_messages_only`, conferir silêncio no grupo e push na conversa individual.
6. Para `disabled`, conferir ausência de push do grupo.
7. Repetir o mesmo pedido de notificação usando o mesmo messageId. A API deve retornar duplicate, sem novo envio.
8. Desativar permissões e tentar ativar novamente pelo perfil; conferir feedback. Invalidar um token e conferir desativação após FCM informar erro de registro.
9. Simular indisponibilidade da API após persistir a mensagem. Conferir mensagem salva e feedback de push pendente. Não reenviar a mensagem para tentar corrigir push.

## Evidências

Salvar prints de login, cadastro, lista de conversas, usuários, criação/edição de grupo, chat, integrantes e perfil. Salvar pelo menos uma notificação real com identificação da plataforma. Não usar alertas locais como prova de push.

Entregar pelo Teams o link do GitHub e a URL HTTPS da API. Conferir os cinco nomes completos e RMs no README.
