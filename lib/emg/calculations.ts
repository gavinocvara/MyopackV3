// lib/emg/calculations.ts
// Ported directly from MyoPack main.cpp and display_ui.cpp

export interface EMGData {
  leftQuad: number
  rightQuad: number
  leftHam: number
  rightHam: number
  balance: number
  timestamp?: Date
}

export type BalanceStatus = 'optimal' | 'caution' | 'alert'

// EMGData field → physical channel mapping:
//   leftQuad  = ch[0] = U1 (CS=21) CH1 → LEFT body side, primary
//   rightQuad = ch[1] = U1 (CS=21) CH2 → LEFT body side, secondary
//   leftHam   = ch[2] = U4 (CS=22) CH1 → RIGHT body side, primary
//   rightHam  = ch[3] = U4 (CS=22) CH2 → RIGHT body side, secondary
// The field names are historical; routing is done by index, not by name.

/**
 * Calculate overall left/right balance.
 * Left body side = U1 (CS=21): ch[0] + ch[1] averaged.
 * Right body side = U4 (CS=22): ch[2] + ch[3] averaged.
 */
export function calculateBalance(emgData: Omit<EMGData, 'balance'>): number {
  // leftQuad and rightQuad are both from U1 (CS=21) = left body side
  const leftAvg = (emgData.leftQuad + emgData.rightQuad) / 2.0
  // leftHam and rightHam are both from U4 (CS=22) = right body side
  const rightAvg = (emgData.leftHam + emgData.rightHam) / 2.0
  const diff = Math.abs(leftAvg - rightAvg)
  return 100.0 - Math.min(diff, 100)
}

/**
 * Maps balance % to a status — mirrors C++ getBalanceColor()
 */
export function getBalanceStatus(balance: number): BalanceStatus {
  if (balance >= 85) return 'optimal'
  if (balance >= 70) return 'caution'
  return 'alert'
}

export function getStatusLabel(status: BalanceStatus): string {
  switch (status) {
    case 'optimal': return 'THRIVING'
    case 'caution': return 'GOOD'
    case 'alert': return 'NEEDS CARE'
  }
}

export function getStatusColor(status: BalanceStatus): string {
  switch (status) {
    case 'optimal': return '#10B981'
    case 'caution': return '#F59E0B'
    case 'alert': return '#EF4444'
  }
}

export interface StatusSemantics {
  status: BalanceStatus
  label: string
  color: string
  bgColor: string
  borderColor: string
  description: string
}

export function getStatusSemantics(balance: number): StatusSemantics {
  const status = getBalanceStatus(balance)
  const color = getStatusColor(status)
  return {
    status,
    label: getStatusLabel(status),
    color,
    bgColor: color + '18',
    borderColor: color + '35',
    description:
      status === 'optimal' ? 'Excellent symmetry — keep it up' :
      status === 'caution' ? 'Minor imbalance — monitor closely' :
      'Significant imbalance detected',
  }
}

/**
 * Constrain value to range — mirrors C++ constrain()
 */
export function constrain(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Simulate one update tick of EMG data — mirrors updateSimulatedData() in main.cpp
 */
export function simulateEMGTick(current: EMGData): EMGData {
  const vary = (v: number) => constrain(v + (Math.random() * 10 - 5), 0, 100)

  const leftQuad = vary(current.leftQuad)
  const rightQuad = vary(current.rightQuad)
  const leftHam = vary(current.leftHam)
  const rightHam = vary(current.rightHam)
  const balance = calculateBalance({ leftQuad, rightQuad, leftHam, rightHam })

  return { leftQuad, rightQuad, leftHam, rightHam, balance, timestamp: new Date() }
}

/**
 * Default initial EMG state (matches C++ initial values)
 */
export const DEFAULT_EMG_DATA: EMGData = {
  leftQuad: 65.0,
  rightQuad: 58.0,
  leftHam: 72.0,
  rightHam: 70.0,
  balance: 88.0,
}

export const DEFAULT_TEMP = 32.4
