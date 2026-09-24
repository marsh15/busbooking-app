import { expect, test } from '@playwright/test'

async function browseToSeats(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Hyderabad → Bengaluru/ }).click()
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  )
  await page.getByLabel('Travel date').fill(tomorrow)
  await page.getByRole('button', { name: /Search buses/ }).click()
  await expect(page.getByRole('heading', { name: /Hyderabad.*Bengaluru/ })).toBeVisible()
  await page.getByRole('link', { name: 'View seats' }).first().click()
}

async function startDemoFromCheckout(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: /Continue to traveller details/ }).click()
  // Anonymous travellers are offered a private demo session at the door.
  await expect(page).toHaveURL(/\/login/)
  await page.getByRole('button', { name: /Start a private demo session/ }).click()
  await expect(page).toHaveURL(/\/checkout\//)
}

test('browse publicly, start a demo, hold seats, pay, and partially cancel', async ({ page }) => {
  await browseToSeats(page)

  const available = page.getByRole('button', { name: /Seat .* available/ })
  await available.nth(0).click()
  await available.nth(1).click()
  await startDemoFromCheckout(page)

  // The server now owns the hold: countdown ticks and refresh restores it.
  const countdown = page.getByRole('timer')
  await expect(countdown).toBeVisible()
  await expect(countdown.getByText(/\d{2}:\d{2}/)).toBeVisible()
  await page.reload()
  await expect(countdown).toBeVisible()

  await page.getByLabel('Full name').nth(0).fill('Anita Rao')
  await page.getByLabel('Full name').nth(1).fill('Vikram Rao')
  await page.getByRole('button', { name: /Confirm simulated payment/ }).click()

  await expect(page.getByRole('heading', { name: 'Your seats are reserved.' })).toBeVisible()
  await page.getByRole('link', { name: 'Manage my booking' }).click()
  await page.getByRole('button', { name: 'Cancel ticket' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByText('PARTIALLY CANCELLED')).toBeVisible()
  await page.getByRole('button', { name: 'Cancel ticket' }).click()
  await page.getByRole('button', { name: 'Confirm cancellation' }).click()
  await expect(page.getByText('CANCELLED', { exact: true })).toBeVisible()
})

test('the booking journey works on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await browseToSeats(page)

  const available = page.getByRole('button', { name: /Seat .* available/ })
  await available.nth(0).click()
  await startDemoFromCheckout(page)

  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByLabel('Full name').nth(0).fill('Mobile Traveller')
  await page.getByRole('button', { name: /Confirm simulated payment/ }).click()

  await expect(page.getByRole('heading', { name: 'Your seats are reserved.' })).toBeVisible()
})
