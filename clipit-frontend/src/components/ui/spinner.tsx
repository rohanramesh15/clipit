import { LoadingAnimation } from "../LoadingAnimation"

function Spinner({ className }: { className?: string }) {
  return <LoadingAnimation className={className || 'size-4'} label="Loading" />
}

export { Spinner }
