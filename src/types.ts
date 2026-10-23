export type ShiftColor =
  | 'gelb'
  | 'rot'
  | 'blau'
  | 'gruen'
  | 'pink'
  | 'dunkelLila'
  | 'hellLila'
  | 'beige'
  | 'betriebsleiter'
  | 'frei'
  | 'krank'
  | 'urlaub'
  | 'ou'
  | 'feiertag'
  | 'sonstiges'

export interface Employee {
  id: string
  name: string
  allowedColors: ShiftColor[]
  isAdmin?: boolean
  avatarUrl?: string
}

export interface ShiftEntry {
  color: ShiftColor
  note?: string
}

export type ScheduleData = Record<string, Record<string, ShiftEntry>>

export interface DayEvent {
  id: string
  date: string
  title: string
  description?: string
}
