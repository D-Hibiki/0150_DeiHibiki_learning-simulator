import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("presents the model scope, comparison, and reproducibility controls", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "学習インフラ冗長性シミュレーター" })).toBeInTheDocument();
    expect(screen.getByText("予測ではありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /シミュレーション実行/ })).toBeEnabled();
    expect(screen.getByLabelText("Base Seed")).toHaveValue(12345);
    expect(screen.getByRole("table")).toHaveTextContent("紙＋電子");
  });

  it("marks results stale after changing a scenario", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: /停電/ }));
    expect(screen.getByText(/設定が変更されています/)).toBeInTheDocument();
    expect(screen.getByLabelText("電子利用可能率")).toHaveValue("0.2");
  });

  it("shows the reproducible report and its explicit limitations", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "反復レポート" }));
    expect(screen.getByText("モデルv1 合成シミュレーションレポート")).toBeInTheDocument();
    expect(screen.getByText(/人間から回答を集めた社会調査ではありません/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /JSON/ })).toBeInTheDocument();
    expect(screen.getByText("試行を重ねたときの累積平均")).toBeInTheDocument();
  });

  it("opens the local-only LLM citizen lab without mixing it with model v1", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Agent World・LLM市民" }));
    expect(await screen.findByRole("heading", { name: /LLM市民の相互作用から/ })).toBeInTheDocument();
    expect(screen.getByText(/LLM市民は人間の代替ではありません/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /シミュレーション実行/ })).not.toBeInTheDocument();
  });
});
