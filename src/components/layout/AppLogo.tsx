'use client'

import Image from 'next/image'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface AppLogoProps {
  href?: string
  titleClassName?: string
  subtitleClassName?: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showSubtitle?: boolean
  subtitle?: string
}

const sizeClasses = {
  sm: 'h-9 w-9',
  md: 'h-10 w-10',
  lg: 'h-11 w-11',
}

const imageSizes = {
  sm: 36,
  md: 40,
  lg: 44,
}

export function AppLogo({
  href,
  titleClassName,
  subtitleClassName,
  className,
  size = 'md',
  showSubtitle = true,
  subtitle = 'Secure workspace',
}: AppLogoProps) {
  const imageSize = imageSizes[size]

  const content = (
    <>
      <div className={cn('relative shrink-0', sizeClasses[size])}>
        <Image
          src="/safe.webp"
          alt="SBC Files logo"
          width={imageSize}
          height={imageSize}
          sizes={`${imageSize}px`}
          className="h-full w-full object-cover"
          priority
        />
      </div>
      <div>
        <span className={cn('block font-semibold leading-none text-white', size === 'md' ? 'text-lg' : size === 'lg' ? 'text-lg' : '', titleClassName)}>
          SBC Files
        </span>
        {showSubtitle && (
          <span className={cn('text-xs text-slate-500', subtitleClassName)}>{subtitle}</span>
        )}
      </div>
    </>
  )

  if (href) {
    return (
      <Link href={href} className={cn('flex items-center gap-2.5', className)}>
        {content}
      </Link>
    )
  }

  return <div className={cn('flex items-center gap-2.5', className)}>{content}</div>
}