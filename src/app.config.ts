export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/map/index',
    'pages/record/index',
    'pages/mine/index',
    'pages/fish/index',
  ],
  subPackages: [
    {
      root: 'package-water',
      pages: ['detail/index'],
    },
    {
      root: 'package-ops',
      pages: ['clues/index'],
    },
  ],
  window: {
    backgroundTextStyle: 'dark',
    backgroundColor: '#F3F7F5',
    navigationBarBackgroundColor: '#F3F7F5',
    navigationBarTitleText: 'Play Holiday',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#70827C',
    selectedColor: '#126B57',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '出钓',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/map/index',
        text: '地图',
        iconPath: 'assets/icons/map.png',
        selectedIconPath: 'assets/icons/map-active.png',
      },
      {
        pagePath: 'pages/record/index',
        text: '记录',
        iconPath: 'assets/icons/record.png',
        selectedIconPath: 'assets/icons/record-active.png',
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/icons/user.png',
        selectedIconPath: 'assets/icons/user-active.png',
      },
    ],
  },
  permission: {
    'scope.userLocation': {
      desc: '用于地图选点和展示附近钓点；拒绝后仍可浏览列表',
    },
  },
  requiredPrivateInfos: ['getLocation', 'chooseLocation'],
});
