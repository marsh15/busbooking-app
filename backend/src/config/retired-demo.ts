// Published shared demo accounts are permanently retired. Preserve their
// records, but reject even still-valid JWTs issued before remediation.
export const retiredDemoAccounts = [
  { id: '6397cbec-ac86-59df-bf29-03e1d31e0798', email: 'demo@voyagebus.in' },
  { id: '7cbc5a83-088d-5443-aabf-78dc8ed00ef2', email: 'demo@smartbus.in' },
  { id: 'demo-user', email: 'demo@smartbus.in' },
]

const retiredDemoIds = new Set(retiredDemoAccounts.map((account) => account.id))
export const isRetiredDemoUser = (userId: string) => retiredDemoIds.has(userId)
