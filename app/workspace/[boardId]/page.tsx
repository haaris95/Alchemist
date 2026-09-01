import Workspace from "@/components/workspace";

type Props = { params: Promise<{ boardId: string }> };

export default async function BoardWorkspacePage({ params }: Props) {
  const { boardId } = await params;
  return <Workspace boardId={boardId} />;
}
