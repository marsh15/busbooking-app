import { expect, test } from '@playwright/test'

test('login, book two seats, confirm, and partially cancel', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email address').fill('demo@voyagebus.in')
  await page.getByLabel('Password').fill('VoyageBus123!')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/$/)

  await page.getByRole('button', { name: /Hyderabad → Bengaluru/ }).click()
  const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(
    new Date(Date.now() + 24 * 60 * 60 * 1000),
  )
  await page.getByLabel('Travel date').fill(tomorrow)
  await page.getByRole('button', { name: /Search buses/ }).click()
  await expect(page.getByRole('heading', { name: /Hyderabad.*Bengaluru/ })).toBeVisible()
  await page.getByRole('link', { name: 'View seats' }).first().click()

  const available = page.getByRole('button', { name: /Seat .* available/ })
  await available.nth(0).click()
  await available.nth(1).click()
  await page.getByRole('button', { name: /Continue to traveller details/ }).click()
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
