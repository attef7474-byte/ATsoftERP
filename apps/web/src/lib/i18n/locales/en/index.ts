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
import validation from './validation';
import system from './system';

const en: LocaleTranslations = {
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
  ...validation,
  ...system,
};

export default en;
