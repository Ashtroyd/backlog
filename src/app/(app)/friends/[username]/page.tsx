import FriendProfile from "@/components/friends/FriendProfile";

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props) {
  const { username } = await params;
  return { title: `@${username}` };
}

export default async function FriendProfilePage({ params }: Props) {
  const { username } = await params;
  return <FriendProfile username={username} />;
}
