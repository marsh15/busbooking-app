export function getApiMessage(error: unknown) {
  return (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
}

export function getApiCode(error: unknown) {
  return (error as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
}
