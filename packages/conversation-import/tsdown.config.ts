import { clientBundle } from '../../packages/client/tsdown.client.ts'

export default clientBundle(
  '@siweimidu/conversation-import',
  ['src/index.ts'],
  { hostPhase: true },
)
