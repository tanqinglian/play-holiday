import { defineConfig, type UserConfigExport } from '@tarojs/cli';
import devConfig from './dev';
import prodConfig from './prod';
import path from 'path';

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'vite'>(async (merge, { command, mode }) => {
  const baseConfig: UserConfigExport<'vite'> = {
    projectName: 'play-holiday',
    date: '2026-6-12',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2,
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {
      PLAY_HOLIDAY_API_BASE_URL: JSON.stringify(
        process.env.PLAY_HOLIDAY_API_BASE_URL || 'http://127.0.0.1:3100',
      ),
      PLAY_HOLIDAY_CLOUD_ENV_ID: JSON.stringify(process.env.PLAY_HOLIDAY_CLOUD_ENV_ID || ''),
      PLAY_HOLIDAY_CLOUD_SERVICE: JSON.stringify(process.env.PLAY_HOLIDAY_CLOUD_SERVICE || ''),
    },
    alias: {
      '@': path.resolve(__dirname, '..', 'src'),
    },
    copy: {
      patterns: [
        {
          from: 'src/assets/markers',
          to: 'dist/assets/markers',
        },
      ],
      options: {},
    },
    framework: 'react',
    compiler: {
      type: 'vite',
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      output: {
        chunkFileNames: 'js/[name].[hash:8].js',
        assetFileNames: 'assets/[name].[hash:8][extname]',
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css',
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]',
          },
        },
      },
    },
  };

  process.env.BROWSERSLIST_ENV = process.env.NODE_ENV;

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig);
  }
  return merge({}, baseConfig, prodConfig);
});
