interface DataEntry {
  key: string;
  value: number;
}

interface TinyChartSettings {
  fillChar: string;
  emptyChar: string;
  prefixChar: string;
  suffixChar: string;
  chartLength: number;
  codeBlock: boolean;
  showLabels: boolean;
  rightAlignLabels: boolean;
}

interface TinyChartSpec {
  data: DataEntry[];
  settings: TinyChartSettings;
}

function parseInput(inputString: string): TinyChartSpec {
  const lines: string[] = inputString.trim().split("\n");
  const result: TinyChartSpec = {
    data: [],
    settings: {
      fillChar: "█",
      emptyChar: "-",
      prefixChar: "",
      suffixChar: "",
      chartLength: 20,
      codeBlock: true,
      showLabels: true,
      rightAlignLabels: true,
    },
  } as TinyChartSpec;

  for (const line of lines) {
    // Check if this is a setting.
    if (line.trim().startsWith("set ")) {
      const parts = line.trim().split(" ");
      if (parts.length !== 3) {
        throw new Error(`Invalid setting: ${line}`);
      }
      const key = parts[1].trim();
      const value = parts[2].trim();

      // Set the setting.
      switch (key) {
        case "fillChar":
        case "emptyChar":
        case "prefixChar":
        case "suffixChar":
          if (value.length !== 1) {
            throw new Error(`Invalid value for ${key}: ${value}`);
          }
          result.settings[key] = value;
          break;
        case "chartLength": {
          const chartLength = parseInt(value, 10);
          if (isNaN(chartLength) || chartLength < 1) {
            throw new Error(`Invalid value for ${key}: ${value}`);
          }
          result.settings.chartLength = chartLength;
          break;
        }
        case "codeBlock":
        case "showLabels":
        case "rightAlignLabels": {
          const boolValue = value.toLowerCase() === "true";
          result.settings[key] = boolValue;
          break;
        }
        default:
          throw new Error(`Unknown setting: ${key}`);
      }

      continue;
    }

    // Parse line as a data entry.
    const [key, value] = line.split(",");
    const trimmedKey: string = key.trim();
    const trimmedValue: number = parseFloat(value.trim());
    result.data.push({ key: trimmedKey, value: trimmedValue });
  }
  return result;
}

function generateBarChart(
  spec: TinyChartSpec
): string {
  const maxValue: number = Math.max(...spec.data.map((entry) => entry.value));
  const maxValueLength: number = maxValue.toString().length;
  const maxKeyLength: number = Math.max(
    ...spec.data.map((entry) => entry.key.length)
  );
  const barChart: string[] = [];
  for (const { key, value } of spec.data) {
    const barLength: number = Math.floor((value / maxValue) * spec.settings.chartLength);
    const bars: string =
      spec.settings.fillChar.repeat(barLength) +
      spec.settings.emptyChar.repeat(spec.settings.chartLength - barLength);
    let value_padded: string = " " + value.toString();

    if (spec.settings.rightAlignLabels === true) {
      value_padded = value_padded.padStart(maxValueLength + 1);
    }

    if (spec.settings.showLabels === true) {
      barChart.push(
        `${key.padEnd(
          maxKeyLength + 2
        )} ${spec.settings.prefixChar}${bars}${spec.settings.suffixChar}${value_padded}`
      );
    } else {
      barChart.push(
        `${key.padEnd(
          maxKeyLength + 2
        )} ${spec.settings.prefixChar}${bars}${spec.settings.suffixChar}`
      );
    }
  }
  return barChart.join("\n");
}

export function tinychartCodeBlockProcessor(source: string, el: HTMLElement) {
  try {
    const parsedSpec: TinyChartSpec = parseInput(source);
    const barChart: string = generateBarChart(parsedSpec);
    // Set the blocktype depending on the setting
    const codeBlockFlag: boolean = parsedSpec.settings.codeBlock;
    let blockType: "pre" | "p";
    if (codeBlockFlag) {
      blockType = "pre";
    } else {
      blockType = "p";
    }
    const block = el.createEl(blockType, {
      attr: { style: "font-family: monospace;" },
    });
    block.innerText = barChart;
  } catch (error) {
    const errorEl = el.createEl("pre", {
      attr: { style: "color: red; font-family: monospace;" },
    });
    errorEl.innerText = "[TinyChart] \n" + error;
  }
}
