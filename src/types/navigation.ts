export type RootStackParams = {
  Login: undefined;
  Register: undefined;
  Conversations: undefined;
  Users: undefined;
  GroupForm: { groupId?: string } | undefined;
  Chat: { conversationId: string };
  Profile: { uid: string };
  Members: { conversationId: string };
};
