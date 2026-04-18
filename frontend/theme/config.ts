import type { ThemeConfig } from 'antd';

const theme: ThemeConfig = {
  token: {
    colorPrimary: '#0078C1',
    colorBgLayout: '#F5F7FA',
    borderRadius: 8,
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Menu: {
      darkItemBg: '#002B5C',
      darkItemColor: 'rgba(255, 255, 255, 0.85)',
      darkItemHoverColor: '#ffffff',
      darkItemSelectedBg: '#003D80',
      darkItemSelectedColor: '#ffffff',
    },
    Layout: {
      siderBg: '#002B5C',
      headerBg: '#ffffff',
    },
    Card: {
      borderRadiusLG: 12,
    },
  },
};

export default theme;
