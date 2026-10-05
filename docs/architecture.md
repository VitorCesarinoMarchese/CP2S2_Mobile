# Arquitetura e decisões

## Contrato

A interface chama a API autenticada para alterações compartilhadas. O servidor grava mensagens no RTDB, e `useChat` mantém listeners de acesso e das últimas 100 mensagens. Firestore fornece perfis próprios, diretório reduzido, conversas, grupos e dispositivos. Perfis completos de terceiros passam pela API e exigem uma conversa ativa em comum. As regras negam escrita cliente em dados compartilhados.

## Alternativas avaliadas

Dois desenhos foram comparados. A alternativa A usa uma trava da conversa no RTDB, uma transação Firestore para os metadados e a publicação do novo acesso. A alternativa B usa reservas de vagas e estados individuais de ingresso/remoção. A revisão escolheu A pela menor quantidade de estados e pela suspensão conservadora de acesso. De B veio a ideia de registrar permanentemente a reivindicação de entrega de push. Não foi adotado reenvio automático de uma entrega incerta, porque o enunciado exige bloquear pedidos duplicados.

## Alteração de grupo

1. A API valida o proprietário, os usuários selecionados, a capacidade e a versão esperada.
2. Uma transação RTDB grava o comando completo em `pending` e muda `gate.phase` para `changing`. A trava serializa comandos concorrentes.
3. A transação Firestore grava o grupo com nova versão, quantidade dentro do limite e proprietário presente.
4. Uma transação RTDB verifica o identificador da operação, publica todos os integrantes e os metadados e libera o acesso.

Enquanto `changing`, as regras negam a leitura das mensagens e a API nega envio e push. Se um serviço falhar, a conversa fica suspensa, com o comando completo persistido. O proprietário pode executar `POST /groups/:id/reconcile`, inclusive depois de reiniciar o servidor. Uma versão já gravada no Firestore torna a repetição idempotente. Uma nova edição deve informar `expectedVersion`; versões antigas recebem HTTP 409.

O cache inicial das transações Firebase pode ser vazio. O adaptador lê o valor antes de iniciar a transação e captura exceções dentro do callback para concluir corretamente abortos durante retries. Toda autorização de envio e inclusão da mensagem acontece na mesma transação RTDB da conversa, sem uma checagem separada seguida de escrita.

## Push

A API confirma a mensagem e o remetente no RTDB, valida acesso atual e lê participantes/política no Firestore. O servidor calcula destinatários. Tokens ficam em subcoleções privadas. As quatro políticas são funções puras testadas; o envio usa Firebase Admin Messaging diretamente, incluindo iOS por APNs configurado no Firebase.

`notificationDeliveries/{conversationId}/messages/{messageId}` é criado em transação antes de chamar FCM. Um registro existente impede uma nova tentativa de envio. O payload contém a conversa, o tipo e o identificador da mensagem; o corpo não inclui o texto do chat. Tokens comprovadamente inválidos são desativados.

A política oferece submissão no máximo uma vez, com um custo explícito: se o processo cair após reivindicar a entrega, ou se FCM responder de forma ambígua, o mesmo pedido não será reenviado. Isso evita push repetido, mas pode perder um push. FCM e Firestore não possuem uma transação distribuída. `failed_or_uncertain` é registrado para inspeção da equipe. O app permite repetir um pedido que não chegou ao servidor, preservando o identificador. Mensagens continuam salvas se o push falhar. Push já entregue ao sistema operacional não pode ser recolhido ao remover um integrante.

## Escala e privacidade

A transação de envio ocorre na raiz de uma conversa para serializar remoção e envio. É uma decisão apropriada ao trabalho, mas lê o histórico dessa conversa no servidor: grupos muito ativos exigem um processamento de comandos mais eficiente. O cliente mantém somente as últimas 100 mensagens. Não há paginação do histórico anterior nesta versão.

O diretório autenticado expõe apenas UID, nome e URL da foto. E-mail, celular e nascimento exigem uma conversa comum. URLs de download do Storage são URLs compartilháveis; não são documentos privados de perfil. Ao encerrar sessão, a árvore autenticada desmonta, os listeners encerram, o dispositivo é removido da API e o token FCM é apagado. Mesmo se a API falhar, a sessão local é encerrada.

## CP1

A configuração cliente foi reutilizada com autorização do usuário. CP1 usa `/conversations`, `/messages` e `/users` no RTDB. Brisa usa `/brisa/conversations` para evitar conflito. `database.rules.json` preserva as regras locais de CP1 e acrescenta um ramo restrito para Brisa. Antes de publicar, comparar essas regras com a configuração atualmente publicada, caso CP1 tenha mudado. Nenhuma regra foi publicada durante a implementação.
