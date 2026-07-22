export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  label?: string | null;
  description?: string | null;
  group: string;
  status: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NumberSequence {
  id: string;
  code: string;
  name: string;
  prefix: string;
  suffix?: string | null;
  currentNumber: number;
  padding: number;
  scope: string;
  resetPolicy: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}
