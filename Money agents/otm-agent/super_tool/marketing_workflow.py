"""
Marketing Workflow Integration
==============================
Automated weekly trading report video generation.
"""

import asyncio
import logging
import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)


@dataclass
class VideoGenerationRequest:
    subject: str
    script: str
    aspect_ratio: str = "9:16"
    voice_name: str = "en-US-male-1"
    background_music: str = "upbeat_corporate.mp3"
    subtitle_enabled: bool = True
    video_quantity: int = 1


@dataclass
class VideoResult:
    task_id: str
    status: str
    video_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = None
    error: Optional[str] = None


class MoneyPrinterClient:
    """Client for MoneyPrinterTurbo API"""

    def __init__(self, base_url: str = "http://localhost:8080", api_key: str = None):
        self.base_url = base_url
        self.headers = (
            {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        )

    def generate_video(self, request: VideoGenerationRequest) -> VideoResult:
        endpoint = f"{self.base_url}/api/v1/videos"
        payload = {
            "video_subject": request.subject,
            "video_script": request.script,
            "video_aspect": request.aspect_ratio,
            "voice_name": request.voice_name,
            "background_music": request.background_music,
            "subtitle_enabled": request.subtitle_enabled,
            "video_quantity": request.video_quantity,
        }
        try:
            response = requests.post(
                endpoint, json=payload, headers=self.headers, timeout=30
            )
            response.raise_for_status()
            data = response.json()
            return VideoResult(
                task_id=data.get("task_id", ""),
                status="pending",
                video_url=data.get("video_url"),
            )
        except Exception as e:
            logger.error(f"Video generation failed: {e}")
            return VideoResult(task_id="", status="failed", error=str(e))

    def get_task_status(self, task_id: str) -> VideoResult:
        endpoint = f"{self.base_url}/api/v1/tasks/{task_id}"
        try:
            response = requests.get(endpoint, headers=self.headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            return VideoResult(
                task_id=task_id,
                status=data.get("status", "unknown"),
                video_url=data.get("video_url"),
            )
        except Exception as e:
            return VideoResult(task_id=task_id, status="failed", error=str(e))

    def wait_for_completion(
        self, task_id: str, timeout: int = 300, poll_interval: int = 5
    ) -> VideoResult:
        import time

        start_time = time.time()
        while time.time() - start_time < timeout:
            result = self.get_task_status(task_id)
            if result.status in ["completed", "failed"]:
                return result
            logger.info(f"Video generation in progress... ({result.status})")
            time.sleep(poll_interval)
        return VideoResult(task_id=task_id, status="failed", error="Timeout")


@dataclass
class Campaign:
    id: str
    name: str
    content: List[str]
    platforms: List[str]
    scheduled_time: Optional[datetime] = None
    status: str = "draft"


class OverlayMarketingClient:
    """Client for Overlay Marketing platform"""

    def __init__(self, base_url: str = "http://localhost:3000", api_key: str = None):
        self.base_url = base_url
        self.api_key = api_key or os.getenv("OVERLAY_API_KEY", "")
        self.headers = (
            {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
        )

    def create_campaign(self, campaign: Campaign) -> Dict[str, Any]:
        endpoint = f"{self.base_url}/api/campaigns"
        payload = {
            "name": campaign.name,
            "content": campaign.content,
            "platforms": campaign.platforms,
        }
        try:
            response = requests.post(
                endpoint, json=payload, headers=self.headers, timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Campaign creation failed: {e}")
            return {"error": str(e)}


class WeeklyReportWorkflow:
    """Automated weekly trading report video workflow."""

    def __init__(
        self,
        moneyprinter_url: str = "http://localhost:8080",
        overlay_url: str = "http://localhost:3000",
        api_key: str = None,
    ):
        self.video_client = MoneyPrinterClient(
            base_url=moneyprinter_url, api_key=api_key
        )
        self.overlay_client = OverlayMarketingClient(
            base_url=overlay_url, api_key=api_key
        )

    def generate_script(self, trading_data: Dict[str, Any]) -> str:
        week = trading_data.get("week", "this week")
        total_return = trading_data.get("total_return", 0.0)
        win_rate = trading_data.get("win_rate", 0.0)
        total_trades = trading_data.get("total_trades", 0)
        top_symbol = trading_data.get("top_symbol", "N/A")
        top_return = trading_data.get("top_return", 0.0)
        sharpe = trading_data.get("sharpe", 0.0)

        return f"""This week's trading performance:

Total return: {total_return:.1f}%
Win rate: {win_rate:.1f}%
Total trades: {total_trades}

Top performer: {top_symbol} with +{top_return:.1f}% return
Sharpe ratio: {sharpe:.2f}

Our AI trading system analyzed market conditions and executed trades with disciplined risk management.

Key insights from {week}:
- Market volatility created opportunities
- Risk-adjusted returns remained strong
- Pattern recognition identified high-probability setups

Looking ahead, we're monitoring Fed policy and earnings season.

Stay tuned for next week's update.""".strip()

    async def run(self, trading_data: Dict[str, Any]) -> Dict[str, Any]:
        logger.info("Starting weekly report workflow...")

        # Generate script
        script = self.generate_script(trading_data)
        logger.info(f"Generated script ({len(script)} chars)")

        # Generate video
        video_request = VideoGenerationRequest(
            subject=f"Weekly Trading Report: {trading_data.get('total_return', 0.0):.1f}% Return",
            script=script,
            aspect_ratio="9:16",
            voice_name="en-US-male-1",
            background_music="upbeat_corporate.mp3",
        )

        video_result = self.video_client.generate_video(video_request)
        if video_result.status == "failed":
            return {
                "success": False,
                "error": video_result.error,
                "step": "video_generation",
            }

        logger.info(f"Video task created: {video_result.task_id}")

        # Wait for completion
        video_result = self.video_client.wait_for_completion(
            video_result.task_id, timeout=300
        )
        if video_result.status != "completed":
            return {
                "success": False,
                "error": video_result.error,
                "step": "video_completion",
            }

        logger.info(f"Video completed: {video_result.video_url}")

        # Create campaign
        campaign = Campaign(
            id=f"weekly_report_{trading_data.get('week', 'unknown')}",
            name=f"Weekly Trading Report - {trading_data.get('week', 'Unknown')}",
            content=[video_result.video_url] if video_result.video_url else [],
            platforms=["youtube", "tiktok", "instagram", "linkedin"],
        )

        campaign_result = self.overlay_client.create_campaign(campaign)
        if "error" in campaign_result:
            return {
                "success": False,
                "error": campaign_result["error"],
                "step": "campaign_creation",
            }

        return {
            "success": True,
            "video_url": video_result.video_url,
            "campaign_id": campaign_result.get("id"),
            "task_id": video_result.task_id,
            "platforms": campaign.platforms,
        }


if __name__ == "__main__":

    async def demo():
        print("=== Weekly Report Video Workflow Demo ===\n")

        trading_data = {
            "week": "2026-W10",
            "total_return": 2.5,
            "win_rate": 0.65,
            "total_trades": 12,
            "top_symbol": "NVDA",
            "top_return": 8.5,
            "sharpe": 1.8,
            "sharpe": 1.8
        }

        print(f"Trading Data:")
        print(f"  Week: {trading_data['week']}")
        print(f"  Return: {trading_data['total_return']:.1f}%")
        print(f"  Win Rate: {trading_data['win_rate']:.1%}")
        print(f"  Trades: {trading_data['total_trades']}")
        print()

        workflow = WeeklyReportWorkflow()
        print("Running workflow...")
        result = await workflow.run(trading_data)

        if result["success"]:
            print(f"\n✅ Success!")
            print(f"  Video URL: {result.get('video_url', 'N/A')}")
            print(f"  Campaign ID: {result.get('campaign_id', 'N/A')}")
            print(f"  Platforms: {', '.join(result.get('platforms', []))}")
        else:
            print(f"\n❌ Failed at: {result.get('step', 'unknown')}")
            print(f"  Error: {result.get('error', 'Unknown')}")

        print("\n=== Demo Complete ===")

    asyncio.run(demo())
