import type { SVGProps } from 'react'

export function BrutalSkullIcon({
  size = 15,
  className = '',
  ...props
}: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
      style={{ display: 'inline-block', verticalAlign: '-1.5px', flexShrink: 0, ...props.style }}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.8 2 3 6.2 3 11.8c0 2.9 1.3 5.4 3.3 7.1V21a1 1 0 0 0 1 1h9.4a1 1 0 0 0 1-1v-2.1c2-1.7 3.3-4.2 3.3-7.1C21 6.2 17.2 2 12 2zm-3.5 11.5a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zm7 0a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zm-4.3 4.2.8-1.7.8 1.7h-1.6zm-2.7 1.3h1.5V20H8.5v-1zm3 0H13V20h-1.5v-1zm3 0H16V20h-1.5v-1z"
      />
    </svg>
  )
}
