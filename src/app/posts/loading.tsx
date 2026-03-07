import ImpLoader from "@/app/components/imp-loader";

export default function PostsLoading() {
  return (
    <div className="flex items-center justify-center h-[100dvh] bg-base-200">
      <ImpLoader />
    </div>
  );
}
