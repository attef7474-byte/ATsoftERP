import type { LocaleTranslations } from '../../types';
import common from './common';
import navigation from './navigation';
import grid from './grid';
import core from './core';
import access from './access';
import settings from './settings';
import inventory from './inventory';
import maintenance from './maintenance';
import barcodes from './barcodes';
import reports from './reports';
import organization from './organization';
import validation from './validation';
import system from './system';
import errorDialog from './error-dialog';
import workspace from './workspace';
import production from './production';
import productionCostTransaction from './production-cost-transaction';
import productionCostCalculation from './production-cost-calculation';
import productionReliability from './production-reliability';
import operationsReports from './operations-reports';
import inventoryValuation from './inventory-valuation';

const ar: LocaleTranslations = {
  ...common,
  ...navigation,
  ...grid,
  ...core,
  ...access,
  ...settings,
  ...inventory,
  ...maintenance,
  ...barcodes,
  ...reports,
  ...organization,
  ...validation,
  ...system,
  ...errorDialog,
  ...workspace,
  ...production,
  ...productionCostTransaction,
  ...productionCostCalculation,
  ...productionReliability,
  ...operationsReports,
  ...inventoryValuation,
};

export default ar;
