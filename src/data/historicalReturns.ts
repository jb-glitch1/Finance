// Historical US asset-class total returns and inflation, 1928–2024.
// Source: Aswath Damodaran (NYU Stern), "Historical Returns on Stocks, Bonds and Bills",
// derived from FRED. Stocks = S&P 500 total return; tbills = 3-mo US T-Bill;
// tbonds = 10-yr US T-Bond total return; inflation = US CPI.
// Values are annual decimal returns (0.10 = +10%). Compiled offline for bootstrap sampling.
// To update: download the latest histretSP file from Damodaran's NYU page and append rows.
//
// PROVENANCE / sourcing notes (all values sourced, none fabricated):
//   All four columns for every year 1928–2024 are taken from Aswath Damodaran's
//   histretSP dataset (NYU Stern), obtained via fetchable public mirrors of that file:
//     - Primary (all years, all 4 cols): GitHub mirror of the Damodaran histretSP.xls
//       https://raw.githubusercontent.com/Sampi314/Finance-Knowledge/main/99_Raw/Damodaran/adamodar_pc_datasets_histretSP_xls.md
//     - Cross-check 1928–2010 (Stocks/Bonds/Bills/CPI), matched the above:
//       https://raw.githubusercontent.com/druce/druce.github.io/master/assets/wp-content/uploads/2013/01/returns.csv
//     - Cross-check 1928–2024 nominal Damodaran TS array:
//       https://raw.githubusercontent.com/dmanjunath/lasagna/main/packages/api/scripts/generate-historical-data.ts
//   Stock total returns independently cross-checked against SlickCharts S&P 500
//   total-return series (via GitHub mirrors of slickcharts.com/sp500/returns, e.g.
//   stilloo123/financeapp data/sp500_returns.json and GodsMoon/bucket-retirement-calculator);
//   they agree with Damodaran to within ~0.15 pct (e.g. 2024: Damodaran 24.88% vs SlickCharts 25.02%).
//   This file uses Damodaran's own figures so all four columns stay internally consistent.
//   Values rounded to 4 decimal places. No cell is a guess/best-effort fill — every cell is sourced.

export interface AnnualReturn {
  year: number;
  stocks: number;   // S&P 500 total return
  tbills: number;   // 3-month T-Bill
  tbonds: number;   // 10-year T-Bond total return
  inflation: number; // US CPI
}

export const HISTORICAL_RETURNS: AnnualReturn[] = [
  { year: 1928, stocks: 0.4381, tbills: 0.0308, tbonds: 0.0083, inflation: -0.0116 },
  { year: 1929, stocks: -0.0830, tbills: 0.0316, tbonds: 0.0420, inflation: 0.0058 },
  { year: 1930, stocks: -0.2512, tbills: 0.0455, tbonds: 0.0454, inflation: -0.0640 },
  { year: 1931, stocks: -0.4384, tbills: 0.0231, tbonds: -0.0256, inflation: -0.0932 },
  { year: 1932, stocks: -0.0864, tbills: 0.0107, tbonds: 0.0879, inflation: -0.1027 },
  { year: 1933, stocks: 0.4998, tbills: 0.0096, tbonds: 0.0186, inflation: 0.0076 },
  { year: 1934, stocks: -0.0119, tbills: 0.0028, tbonds: 0.0796, inflation: 0.0152 },
  { year: 1935, stocks: 0.4674, tbills: 0.0017, tbonds: 0.0447, inflation: 0.0299 },
  { year: 1936, stocks: 0.3194, tbills: 0.0017, tbonds: 0.0502, inflation: 0.0145 },
  { year: 1937, stocks: -0.3534, tbills: 0.0028, tbonds: 0.0138, inflation: 0.0286 },
  { year: 1938, stocks: 0.2928, tbills: 0.0007, tbonds: 0.0421, inflation: -0.0278 },
  { year: 1939, stocks: -0.0110, tbills: 0.0005, tbonds: 0.0441, inflation: 0.0000 },
  { year: 1940, stocks: -0.1067, tbills: 0.0004, tbonds: 0.0540, inflation: 0.0071 },
  { year: 1941, stocks: -0.1277, tbills: 0.0013, tbonds: -0.0202, inflation: 0.0993 },
  { year: 1942, stocks: 0.1917, tbills: 0.0034, tbonds: 0.0229, inflation: 0.0903 },
  { year: 1943, stocks: 0.2506, tbills: 0.0038, tbonds: 0.0249, inflation: 0.0296 },
  { year: 1944, stocks: 0.1903, tbills: 0.0038, tbonds: 0.0258, inflation: 0.0230 },
  { year: 1945, stocks: 0.3582, tbills: 0.0038, tbonds: 0.0380, inflation: 0.0225 },
  { year: 1946, stocks: -0.0843, tbills: 0.0038, tbonds: 0.0313, inflation: 0.1813 },
  { year: 1947, stocks: 0.0520, tbills: 0.0060, tbonds: 0.0092, inflation: 0.0884 },
  { year: 1948, stocks: 0.0570, tbills: 0.0105, tbonds: 0.0195, inflation: 0.0299 },
  { year: 1949, stocks: 0.1830, tbills: 0.0112, tbonds: 0.0466, inflation: -0.0207 },
  { year: 1950, stocks: 0.3081, tbills: 0.0120, tbonds: 0.0043, inflation: 0.0593 },
  { year: 1951, stocks: 0.2368, tbills: 0.0152, tbonds: -0.0030, inflation: 0.0600 },
  { year: 1952, stocks: 0.1815, tbills: 0.0172, tbonds: 0.0227, inflation: 0.0075 },
  { year: 1953, stocks: -0.0121, tbills: 0.0189, tbonds: 0.0414, inflation: 0.0075 },
  { year: 1954, stocks: 0.5256, tbills: 0.0094, tbonds: 0.0329, inflation: -0.0074 },
  { year: 1955, stocks: 0.3260, tbills: 0.0172, tbonds: -0.0134, inflation: 0.0037 },
  { year: 1956, stocks: 0.0744, tbills: 0.0262, tbonds: -0.0226, inflation: 0.0299 },
  { year: 1957, stocks: -0.1046, tbills: 0.0322, tbonds: 0.0680, inflation: 0.0290 },
  { year: 1958, stocks: 0.4372, tbills: 0.0177, tbonds: -0.0210, inflation: 0.0176 },
  { year: 1959, stocks: 0.1206, tbills: 0.0339, tbonds: -0.0265, inflation: 0.0173 },
  { year: 1960, stocks: 0.0034, tbills: 0.0287, tbonds: 0.1164, inflation: 0.0136 },
  { year: 1961, stocks: 0.2664, tbills: 0.0235, tbonds: 0.0206, inflation: 0.0067 },
  { year: 1962, stocks: -0.0881, tbills: 0.0277, tbonds: 0.0569, inflation: 0.0133 },
  { year: 1963, stocks: 0.2261, tbills: 0.0316, tbonds: 0.0168, inflation: 0.0165 },
  { year: 1964, stocks: 0.1642, tbills: 0.0355, tbonds: 0.0373, inflation: 0.0097 },
  { year: 1965, stocks: 0.1240, tbills: 0.0395, tbonds: 0.0072, inflation: 0.0192 },
  { year: 1966, stocks: -0.0997, tbills: 0.0486, tbonds: 0.0291, inflation: 0.0346 },
  { year: 1967, stocks: 0.2380, tbills: 0.0429, tbonds: -0.0158, inflation: 0.0304 },
  { year: 1968, stocks: 0.1081, tbills: 0.0534, tbonds: 0.0327, inflation: 0.0472 },
  { year: 1969, stocks: -0.0824, tbills: 0.0667, tbonds: -0.0501, inflation: 0.0620 },
  { year: 1970, stocks: 0.0356, tbills: 0.0639, tbonds: 0.1675, inflation: 0.0557 },
  { year: 1971, stocks: 0.1422, tbills: 0.0433, tbonds: 0.0979, inflation: 0.0327 },
  { year: 1972, stocks: 0.1876, tbills: 0.0406, tbonds: 0.0282, inflation: 0.0341 },
  { year: 1973, stocks: -0.1431, tbills: 0.0704, tbonds: 0.0366, inflation: 0.0871 },
  { year: 1974, stocks: -0.2590, tbills: 0.0785, tbonds: 0.0199, inflation: 0.1234 },
  { year: 1975, stocks: 0.3700, tbills: 0.0579, tbonds: 0.0361, inflation: 0.0694 },
  { year: 1976, stocks: 0.2383, tbills: 0.0498, tbonds: 0.1598, inflation: 0.0486 },
  { year: 1977, stocks: -0.0698, tbills: 0.0526, tbonds: 0.0129, inflation: 0.0670 },
  { year: 1978, stocks: 0.0651, tbills: 0.0718, tbonds: -0.0078, inflation: 0.0902 },
  { year: 1979, stocks: 0.1852, tbills: 0.1005, tbonds: 0.0067, inflation: 0.1329 },
  { year: 1980, stocks: 0.3174, tbills: 0.1139, tbonds: -0.0299, inflation: 0.1252 },
  { year: 1981, stocks: -0.0470, tbills: 0.1404, tbonds: 0.0820, inflation: 0.0892 },
  { year: 1982, stocks: 0.2042, tbills: 0.1109, tbonds: 0.3281, inflation: 0.0383 },
  { year: 1983, stocks: 0.2234, tbills: 0.0895, tbonds: 0.0320, inflation: 0.0379 },
  { year: 1984, stocks: 0.0615, tbills: 0.0992, tbonds: 0.1373, inflation: 0.0395 },
  { year: 1985, stocks: 0.3124, tbills: 0.0772, tbonds: 0.2571, inflation: 0.0380 },
  { year: 1986, stocks: 0.1849, tbills: 0.0615, tbonds: 0.2428, inflation: 0.0110 },
  { year: 1987, stocks: 0.0581, tbills: 0.0596, tbonds: -0.0496, inflation: 0.0443 },
  { year: 1988, stocks: 0.1654, tbills: 0.0689, tbonds: 0.0822, inflation: 0.0442 },
  { year: 1989, stocks: 0.3148, tbills: 0.0839, tbonds: 0.1769, inflation: 0.0465 },
  { year: 1990, stocks: -0.0306, tbills: 0.0775, tbonds: 0.0624, inflation: 0.0611 },
  { year: 1991, stocks: 0.3023, tbills: 0.0554, tbonds: 0.1500, inflation: 0.0306 },
  { year: 1992, stocks: 0.0749, tbills: 0.0351, tbonds: 0.0936, inflation: 0.0290 },
  { year: 1993, stocks: 0.0997, tbills: 0.0307, tbonds: 0.1421, inflation: 0.0275 },
  { year: 1994, stocks: 0.0133, tbills: 0.0437, tbonds: -0.0804, inflation: 0.0267 },
  { year: 1995, stocks: 0.3720, tbills: 0.0566, tbonds: 0.2348, inflation: 0.0254 },
  { year: 1996, stocks: 0.2268, tbills: 0.0515, tbonds: 0.0143, inflation: 0.0332 },
  { year: 1997, stocks: 0.3310, tbills: 0.0520, tbonds: 0.0994, inflation: 0.0170 },
  { year: 1998, stocks: 0.2834, tbills: 0.0491, tbonds: 0.1492, inflation: 0.0161 },
  { year: 1999, stocks: 0.2089, tbills: 0.0478, tbonds: -0.0825, inflation: 0.0268 },
  { year: 2000, stocks: -0.0903, tbills: 0.0600, tbonds: 0.1666, inflation: 0.0339 },
  { year: 2001, stocks: -0.1185, tbills: 0.0348, tbonds: 0.0557, inflation: 0.0155 },
  { year: 2002, stocks: -0.2197, tbills: 0.0164, tbonds: 0.1512, inflation: 0.0238 },
  { year: 2003, stocks: 0.2836, tbills: 0.0103, tbonds: 0.0038, inflation: 0.0188 },
  { year: 2004, stocks: 0.1074, tbills: 0.0140, tbonds: 0.0449, inflation: 0.0326 },
  { year: 2005, stocks: 0.0483, tbills: 0.0322, tbonds: 0.0287, inflation: 0.0342 },
  { year: 2006, stocks: 0.1561, tbills: 0.0485, tbonds: 0.0196, inflation: 0.0254 },
  { year: 2007, stocks: 0.0548, tbills: 0.0448, tbonds: 0.1021, inflation: 0.0408 },
  { year: 2008, stocks: -0.3655, tbills: 0.0140, tbonds: 0.2010, inflation: 0.0009 },
  { year: 2009, stocks: 0.2594, tbills: 0.0015, tbonds: -0.1112, inflation: 0.0272 },
  { year: 2010, stocks: 0.1482, tbills: 0.0014, tbonds: 0.0846, inflation: 0.0150 },
  { year: 2011, stocks: 0.0210, tbills: 0.0005, tbonds: 0.1604, inflation: 0.0296 },
  { year: 2012, stocks: 0.1589, tbills: 0.0009, tbonds: 0.0297, inflation: 0.0174 },
  { year: 2013, stocks: 0.3215, tbills: 0.0006, tbonds: -0.0910, inflation: 0.0150 },
  { year: 2014, stocks: 0.1352, tbills: 0.0003, tbonds: 0.1075, inflation: 0.0076 },
  { year: 2015, stocks: 0.0138, tbills: 0.0005, tbonds: 0.0128, inflation: 0.0073 },
  { year: 2016, stocks: 0.1177, tbills: 0.0032, tbonds: 0.0069, inflation: 0.0207 },
  { year: 2017, stocks: 0.2161, tbills: 0.0095, tbonds: 0.0280, inflation: 0.0211 },
  { year: 2018, stocks: -0.0423, tbills: 0.0197, tbonds: -0.0002, inflation: 0.0191 },
  { year: 2019, stocks: 0.3121, tbills: 0.0211, tbonds: 0.0964, inflation: 0.0229 },
  { year: 2020, stocks: 0.1802, tbills: 0.0036, tbonds: 0.1133, inflation: 0.0136 },
  { year: 2021, stocks: 0.2847, tbills: 0.0004, tbonds: -0.0442, inflation: 0.0704 },
  { year: 2022, stocks: -0.1804, tbills: 0.0209, tbonds: -0.1783, inflation: 0.0645 },
  { year: 2023, stocks: 0.2606, tbills: 0.0528, tbonds: 0.0388, inflation: 0.0335 },
  { year: 2024, stocks: 0.2488, tbills: 0.0518, tbonds: -0.0164, inflation: 0.0289 },
];
