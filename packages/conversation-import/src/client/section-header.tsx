/**
 * Section header for the settings section.
 *
 * The fork ships a `SettingsSectionHeader` primitive; stock DSH does not, and
 * rendering an undefined component would crash the settings page. Use the host
 * primitive when present and fall back to plain markup otherwise.
 */
import { createElement, type ComponentType, type ReactElement } from 'react'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

export interface SectionHeaderProps {
  readonly className?: string | undefined
  readonly title: string
  readonly description: string
}

const hostHeader = (primitives as unknown as Record<string, unknown>)['SettingsSectionHeader'] as
  | ComponentType<SectionHeaderProps>
  | undefined

export function SectionHeader({ className, title, description }: SectionHeaderProps): ReactElement {
  if (hostHeader !== undefined) return createElement(hostHeader, { className, title, description })
  return createElement('header', { className }, [
    createElement('h2', { key: 'title' }, title),
    createElement('p', { key: 'description' }, description),
  ])
}
