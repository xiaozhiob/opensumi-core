import { Injectable, Autowired } from '@ali/common-di';
import * as path from 'path';
import { uuid, INodeLogger, Uri } from '@ali/ide-core-node';
import * as os from 'os';
import { createHash } from 'crypto';

import { ExtraMetaData, IExtensionMetaData, IExtensionNodeService, IExtensionNodeClientService } from '../common';
import { RPCService } from '@ali/ide-connection';
import * as lp from './languagePack';
import { IExtensionStoragePathServer } from '@ali/ide-extension-storage';
import { IFileService } from '@ali/ide-file-service';

export const DEFAULT_NLS_CONFIG_DIR = path.join(os.homedir(), '.kaitian');

@Injectable()
export class ExtensionServiceClientImpl extends RPCService implements IExtensionNodeClientService {

  @Autowired(IExtensionNodeService)
  private extensionService: IExtensionNodeService;

  @Autowired(IExtensionStoragePathServer)
  private extensionStoragePathServer: IExtensionStoragePathServer;

  @Autowired(IFileService)
  private fileService: IFileService;

  @Autowired(INodeLogger)
  logger: INodeLogger;

  private clientId: string;

  public setConnectionClientId(clientId: string) {
    this.clientId = clientId;
    this.extensionService.setConnectionServiceClient(this.clientId, this);
  }

  public infoProcessNotExist() {
    if (this.rpcClient) {
      this.rpcClient[0].processNotExist(this.clientId);
    }
  }

  public infoProcessCrash() {
    if (this.rpcClient) {
      this.rpcClient[0].processCrashRestart(this.clientId);
    }
  }

  public async getElectronMainThreadListenPath(clientId: string) {
    return this.extensionService.getElectronMainThreadListenPath(clientId);
  }
  /**
   * 创建插件进程
   *
   * @param clientId 客户端 id
   */
  public async createProcess(clientId: string): Promise<void> {
    await this.extensionService.createProcess2(clientId);
  }

  /**
   * 获取插件信息
   *
   * @param extensionPath 插件路径
   * @param extraMetaData 补充数据
   */
  public async getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await this.extensionService.getExtension(extensionPath, localization, extraMetaData);
  }

  /**
   * 获取所有插件
   *
   * @param scan 插件存放目录
   * @param extensionCandidate 执行插件目录
   * @param extraMetaData 扫描数据字段
   */
  public async getAllExtensions(
    scan: string[],
    extensionCandidate: string[],
    localization: string,
    extraMetaData: { [key: string]: any } = {}): Promise<IExtensionMetaData[]> {
    return await this.extensionService.getAllExtensions(scan, extensionCandidate, localization, extraMetaData);
  }

  public async disposeClientExtProcess(clientId: string, info: boolean = true): Promise<void> {
    return await this.extensionService.disposeClientExtProcess(clientId, info);
  }

  /**
   * 将 packageJson 中声明的语言信息转换
   * @param packageJson package.json
   * @param languagePackPath language pack path
   */
  private convertLanguagePack(packageJson, languagePackPath: string) {
    const { contributes: { localizations }, publisher, name, version } = packageJson;
    const languagePacks: { [key: string]: any } = {};
    for (const localization of localizations) {
      const md5 = createHash('md5');
      // 这里需要添加languagePack路径作为id一部分，因为可能存在多个
      const id = `${languagePackPath}-${publisher.toLocaleLowerCase()}.${name.toLocaleLowerCase()}`;
      const _uuid = uuid();
      md5.update(id).update(version);
      const hash = md5.digest('hex');
      languagePacks[localization.languageId] = {
        hash,
        extensions: [{
          version,
          extensionIdentifier: {
            id,
            uuid: _uuid,
          },
        }],
        translations: localization.translations.reduce((pre, translation) => {
          pre[translation.id] = path.join(languagePackPath, translation.path);
          return pre;
        }, {}),
      };
    }
    return languagePacks;
  }

  public async updateLanguagePack(languageId: string, languagePack: string): Promise<void> {
    let languagePacks: { [key: string]: any } = {};
    const storagePath = await this.extensionStoragePathServer.getLastStoragePath() || DEFAULT_NLS_CONFIG_DIR;
    this.logger.log(`find ${languageId}， storagePath：${storagePath}`);
    const languagePath = Uri.file(path.join(storagePath, 'languagepacks.json')).toString();
    if (await this.fileService.exists(languagePath)) {
      const rawLanguagePacks = await this.fileService.resolveContent(languagePath);
      try {
        languagePacks = JSON.parse(rawLanguagePacks.content);
      } catch (err) {
        this.logger.error(err.message);
      }
    } else {
      await this.fileService.createFile(languagePath);
    }

    const rawPkgJson = (await this.fileService.resolveContent(Uri.file(path.join(languagePack, 'package.json')).toString())).content;
    let packageJson;
    try {
      packageJson = JSON.parse(rawPkgJson);
    } catch (err) {
      this.logger.error(err.message);
    }

    if (packageJson?.contributes && packageJson?.contributes?.localizations) {
      languagePacks = {
        ...languagePacks,
        ...this.convertLanguagePack(packageJson, languagePack),
      };
    }

    const languagePackJson = await this.fileService.getFileStat(languagePath);
    this.fileService.setContent(languagePackJson!, JSON.stringify(languagePacks));

    const nlsConfig = await lp.getNLSConfiguration('f06011ac164ae4dc8e753a3fe7f9549844d15e35', storagePath, languageId.toLowerCase());
    // tslint:disable-next-line: no-string-literal
    nlsConfig['_languagePackSupport'] = true;
    process.env.VSCODE_NLS_CONFIG = JSON.stringify(nlsConfig);
  }
}
