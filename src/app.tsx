import { type PropsWithChildren } from 'react';
import Taro, { useLaunch } from '@tarojs/taro';
import './app.less';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    if (PLAY_HOLIDAY_CLOUD_ENV_ID) {
      Taro.cloud.init({ env: PLAY_HOLIDAY_CLOUD_ENV_ID, traceUser: true });
    }
    if (process.env.NODE_ENV === 'development') {
      Taro.setEnableDebug({ enableDebug: true });
    }
  });

  return children;
}

export default App;
