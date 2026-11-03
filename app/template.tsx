// Templates remount on every navigation, which replays the CSS page transition.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
