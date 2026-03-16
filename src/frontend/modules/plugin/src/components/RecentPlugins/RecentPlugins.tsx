import { Carousel } from "@mantine/carousel";
import { usePlugins } from "@ocelescope/api-base";
import { PluginCard, UploadPluginCard } from "../PluginCard/PluginCard";

const RecentPlugins: React.FC = () => {
  const { data: plugins } = usePlugins();

  return (
    plugins && (
      <Carousel
        withIndicators
        height={200}
        slideSize={{ base: "100%", sm: "50%", md: "33.333333%" }}
        slideGap={{ base: 0, sm: "md" }}
        emblaOptions={{ loop: true, align: "start" }}
      >
        {plugins.map((plugin) => (
          <Carousel.Slide key={plugin.id}>
            <PluginCard plugin={plugin} />
          </Carousel.Slide>
        ))}
        <Carousel.Slide>
          <UploadPluginCard />
        </Carousel.Slide>
      </Carousel>
    )
  );
};

export default RecentPlugins;
