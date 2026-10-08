/** Short names for generated schema types. Never hand-write API types; alias them here. */
import type { components } from './schema'

type Schemas = components['schemas']

export type FileStatus = Schemas['FileStatus']
export type MeasurementStatus = Schemas['MeasurementStatus']
export type FileType = Schemas['FileType']
export type FileInfo = Schemas['FileInfo']
export type MeasurementList = Schemas['MeasurementList']
export type Measurement = Schemas['MeasurementOut']
