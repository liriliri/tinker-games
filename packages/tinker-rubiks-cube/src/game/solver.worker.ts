import { findSolution, prepareSolver } from './solverCore'
import type { SolverRequest, SolverResponse } from './solverProtocol'

type SolverWorkerScope = {
  onmessage: ((ev: MessageEvent<SolverRequest>) => void) | null
  postMessage: (message: SolverResponse) => void
}

const scope = self as unknown as SolverWorkerScope

function reply(msg: SolverResponse): void {
  scope.postMessage(msg)
}

scope.onmessage = (ev) => {
  const msg = ev.data
  void (async () => {
    try {
      if (msg.type === 'prepare') {
        await prepareSolver()
        reply({ type: 'prepared' })
        return
      }
      const moves = await findSolution(msg.state)
      reply({ type: 'solved', id: msg.id, moves })
    } catch (err) {
      reply({
        type: 'error',
        id: msg.type === 'solve' ? msg.id : undefined,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  })()
}
