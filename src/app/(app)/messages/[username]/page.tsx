import MessagesConversation from "@/components/messages/MessagesConversation";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `Chat · @${username}` };
}

export default async function ConversationPage({ params }: Props) {
  const { username } = await params;
  return <MessagesConversation username={username} />;
}
