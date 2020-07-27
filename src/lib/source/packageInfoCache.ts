import { Config } from '../core/configApi';
import { Nullable } from '@salesforce/ts-types';
import * as path from 'path';

interface PackageConfig {
  path: string;
  name: string;
  default: boolean;
}

interface AppConfig {
  defaultPackagePath: string;
  packageDirectories: { path: string; default: boolean }[];
  packageDirectoryPaths: string[];
}

/**
 * Singleton class that represents the package directories defined in sfdx-project.json
 * as well as the "active" package directory during deployment/retrieval of source.
 * Provides the ability to parse source files for their package data, get the default
 * package, and other package directory utilities.
 */
export class PackageInfoCache {
  private static instance: PackageInfoCache;
  public packageConfigs: PackageConfig[];
  public packageNames: string[] = [];
  public packagePaths: string[] = [];
  public defaultPackage: PackageConfig;
  private activePackage: Nullable<PackageConfig>;

  private constructor() {}

  private static create() {
    const instance = new PackageInfoCache();
    instance.init();
    return instance;
  }

  private init() {
    this.packageConfigs = this.buildPackageList();
    this.defaultPackage = this.packageConfigs[0];
    this.packageConfigs.forEach(p => {
      this.packageNames.push(p.name);
      this.packagePaths.push(p.path);
      if (p.default) {
        this.defaultPackage = p;
      }
    });
    this.activePackage = Object.assign({}, this.defaultPackage);
  }

  public static getInstance(): PackageInfoCache {
    if (!PackageInfoCache.instance) {
      PackageInfoCache.instance = PackageInfoCache.create();
    }
    return PackageInfoCache.instance;
  }

  private buildPackageList(): PackageConfig[] {
    const config = new Config().getAppConfig() as AppConfig;
    // There can be multiple packages that point to the same directory. SDD only want packages that point to
    // unique directories but this may not be true for packaging. If this class ever if used for packaging, be aware.
    const packageDirectoryPaths = [...new Set(config.packageDirectoryPaths)];
    return packageDirectoryPaths.map(pkgPath => {
      const pkgConfig = config.packageDirectories.find(p => pkgPath.endsWith(path.basename(p.path)));
      const packagePath = pkgPath.endsWith(path.sep) ? pkgPath : `${pkgPath}${path.sep}`;
      return {
        path: packagePath,
        name: pkgConfig.path.startsWith(`.${path.sep}`) ? pkgConfig.path.replace(`.${path.sep}`, '') : pkgConfig.path,
        default: pkgConfig.default || false
      };
    });
  }

  public getPackageNameFromSourcePath(sourcePath: string): Nullable<string> {
    const match = this.packageConfigs.find(p => path.basename(sourcePath) === p.name || sourcePath.includes(p.path));
    return match ? match.name : null;
  }

  /**
   * Returns the absolute path of the package directory ending with the path separator.
   * E.g., /Users/jsmith/projects/ebikes-lwc/force-app/
   *
   * @param packageName Name of the package directory.  E.g., 'force-app'
   */
  public getPackagePath(packageName: string): Nullable<string> {
    const match = this.packageConfigs.find(p => p.name === packageName);
    return match ? match.path : null;
  }

  public getActivePackage(): Nullable<PackageConfig> {
    return this.activePackage;
  }

  public setActivePackage(pkgName: Nullable<string>) {
    const activePackage = this.packageConfigs.find(p => p.name === pkgName);
    this.activePackage = activePackage ? Object.assign({}, activePackage) : null;
  }

  public hasMultiplePackages(): boolean {
    return this.packageConfigs.length > 1;
  }

  public getDefaultPackage(): PackageConfig {
    return this.defaultPackage;
  }
}
