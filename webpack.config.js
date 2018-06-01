module.exports = {
  // メインとなるJavaScriptファイル（エントリーポイント）
  entry: {
    "DemoIcons_4000": './src/DemoIcons_4000.ts',
    "DemoCubes": './src/DemoCubes.ts',
    "DemoIcons": './src/DemoIcons.ts',
  },
  // ファイルの出力設定
  output: {
    //  出力ファイルのディレクトリ名
    path: `${__dirname}/docs`,
    // 出力ファイル名
    filename: '[name].js'
  },
  module: {
    rules: [{
        // 拡張子 .ts の場合
        test: /\.ts$/,
        // TypeScript をコンパイルする
        use: 'ts-loader'
      },
      {
        test: /\.css/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              url: false,
              minimize: true
            }
          },
        ],
      },
    ]
  },
  // import 文で .ts ファイルを解決するため
  resolve: {
    extensions: [
      '.ts', '.js'
    ],
  },
  // webpack-serve の設定
  serve: {
    open: true,
    content: './dist'
  }
};