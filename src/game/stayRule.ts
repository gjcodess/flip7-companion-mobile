export type MinimumNumberCardsToStay = 1 | 2 | 3 | 4 | 5

export function meetsStayMinimum(numberCards: number, minimum?: MinimumNumberCardsToStay) {
  return minimum === undefined || numberCards >= minimum
}

export function stayRuleLabel(minimum?: MinimumNumberCardsToStay) {
  return minimum === undefined ? 'Standard Stay/Bank rules' : `${minimum} Number cards to Stay/Bank`
}
