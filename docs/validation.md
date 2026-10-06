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

## Teste nativo realizado em 2026-10-05

Development build Android compilado e instalado no emulador Brisa, Android 15 com Google Play. Confirmados login por senha, perfil Firestore, token FCM privado, mensagem RTDB, push recebido em segundo plano, toque abrindo a conversa e deduplicação pela API online. Capturas: `screenshots/android-push.png` e `screenshots/android-chat.png`. Regras Firestore e RTDB publicadas; regras anteriores de CP1 no RTDB preservadas. Este teste não valida iOS, app encerrado, fotos ou todas as políticas de grupo.

Na API publicada, 14 checks adicionais passaram: unicidade de conversa individual, deduplicação, capacidade de grupo, autorização do proprietário, redução de limite, edições concorrentes, quatro políticas de push e bloqueio de integrante removido. Resultados em `live-api-checks.txt`; roteiro reproduzível em `../scripts/verify-live-api.mjs`. Os números de entrega da API indicam aceitação pelo FCM. A bandeja do Android confirmou também recebimento de menção de grupo, em `screenshots/android-group-push.png`.

Render Free foi mantido por escolha da equipe. O serviço pode suspender após inatividade. Fotos foram migradas para Supabase Storage Free por escolha da equipe; configuração do bucket e credenciais no Render, seguida de teste de upload, ainda precisam ser concluídas. iOS permanece sem teste por decisão da equipe.

APK standalone compilado para ARM64 e x86_64, instalado no Android 15. Com Metro desligado, confirmou restauração da sessão, listagem de conversas, chat de grupo, integrantes e consulta de perfil compartilhado. SHA-256: `74b2928c7dd40774080796f178c79f78bed7c7135751b8236597935c8abfb4a7`. Fotos ainda dependem da configuração Supabase no Render.

Regressão de timeout: o prazo de 90 segundos inclui obtenção do ID Token, fetch e leitura da resposta. `node --import tsx scripts/verify-api-deadline.mjs`, após setup das contas temporárias, verifica erro de prazo mesmo com obtenção de token bloqueada.

Edição nativa de grupo confirmada: proprietário alterou o limite de 4 para 3 no APK e voltou ao chat com uma vaga disponível. A API retornou o limite persistido.

No APK standalone, uma nova menção de grupo recebeu FCM em segundo plano. O toque abriu o grupo correto e exibiu `Menção no APK Android`; captura atualizada em `screenshots/android-group-chat.png`.
