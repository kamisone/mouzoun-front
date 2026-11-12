/**
 * Stripe Payment Element appearance, from the design tokens (Stripe needs plain colour values,
 * not CSS variables). Keep in sync with app/assets/css/main.css.
 */
export function stripeAppearance(dark: boolean) {
  return {
    theme: 'flat' as const,
    variables: {
      colorPrimary: dark ? '#D7896B' : '#A4502F',
      colorBackground: dark ? '#1B1814' : '#FFFDF9',
      colorText: dark ? '#F2ECE2' : '#1C1915',
      colorTextSecondary: dark ? '#A39886' : '#6B6258',
      colorDanger: dark ? '#E0907F' : '#A13B2F',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: '2px',
      spacingUnit: '4px',
    },
    rules: {
      '.Input': { border: `1px solid ${dark ? '#2C2721' : '#E2D9CA'}`, boxShadow: 'none' },
      '.Input:focus': { borderColor: dark ? '#D7896B' : '#A4502F', boxShadow: 'none' },
    },
  }
}
